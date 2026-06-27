// functions/src/__tests__/WebhookNormalizer.test.ts

// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
// WebhookNormalizer receives raw Paddle payloads
// and converts them to our internal PaymentEvent format
//
// This is critical because:
// - If mapping is wrong → wrong user gets Pro
// - If atlassianId is missing → nobody gets upgraded
// - If event type is wrong → cancellations not handled
// ─────────────────────────────────────────────────────────────

import { WebhookNormalizer } from "../payments/WebhookNormalizer";

// Create one instance — reused in all tests
// No mocking needed here because WebhookNormalizer
// is pure logic — no DB, no network, no side effects
const normalizer = new WebhookNormalizer();

describe("WebhookNormalizer.fromPaddle", () => {

  // ─────────────────────────────────────────────────────────
  // GROUP 1 — transaction.completed event
  // This is the main event fired when user pays
  // ─────────────────────────────────────────────────────────
  describe("transaction.completed", () => {

    it("maps to subscription.activated type", () => {
      // ARRANGE — this is what Paddle actually sends us
      const payload = {
        event_type: "transaction.completed",
        data: {
          id: "txn_123",
          subscription_id: "sub_456",
          custom_data: { atlassianId: "user_abc" },
        },
      };

      // ACT
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      // transaction.completed means user paid
      // we map this to subscription.activated internally
      expect(event.type).toBe("subscription.activated");
    });

    it("correctly extracts atlassianId from custom_data", () => {
      // ARRANGE
      // atlassianId is stored in custom_data during checkout
      // we set this in PaddleProvider.createCheckout()
      const payload = {
        event_type: "transaction.completed",
        data: {
          id: "txn_123",
          subscription_id: "sub_456",
          custom_data: { atlassianId: "user_abc_123" },
        },
      };

      // ACT
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      // this is how we know WHICH user to upgrade
      expect(event.atlassianId).toBe("user_abc_123");
    });

    it("correctly extracts subscriptionId", () => {
      // ARRANGE
      const payload = {
        event_type: "transaction.completed",
        data: {
          id: "txn_123",
          subscription_id: "sub_paddle_789",
          custom_data: { atlassianId: "user_abc" },
        },
      };

      // ACT
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      // we store this in MongoDB for future reference
      expect(event.subscriptionId).toBe("sub_paddle_789");
    });

    it("sets expiresAt to 30 days from now", () => {
      // ARRANGE
      const beforeTest = new Date();

      const payload = {
        event_type: "transaction.completed",
        data: {
          id: "txn_123",
          subscription_id: "sub_456",
          custom_data: { atlassianId: "user_abc" },
        },
      };

      // ACT
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      // expiresAt should exist
      expect(event.expiresAt).toBeDefined();

      // expiresAt should be roughly 30 days from now
      // we check it is in the future
      expect(event.expiresAt!.getTime()).toBeGreaterThan(beforeTest.getTime());

      // and less than 31 days from now
      const maxExpiry = new Date();
      maxExpiry.setDate(maxExpiry.getDate() + 31);
      expect(event.expiresAt!.getTime()).toBeLessThan(maxExpiry.getTime());
    });

  });

  // ─────────────────────────────────────────────────────────
  // GROUP 2 — subscription.activated event
  // Paddle also fires this separately after transaction
  // ─────────────────────────────────────────────────────────
  describe("subscription.activated", () => {

    it("maps to subscription.activated type", () => {
      // ARRANGE
      const payload = {
        event_type: "subscription.activated",
        data: {
          id: "sub_456",
          subscription_id: "sub_456",
          custom_data: { atlassianId: "user_abc" },
        },
      };

      // ACT
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      expect(event.type).toBe("subscription.activated");
    });

  });

  // ─────────────────────────────────────────────────────────
  // GROUP 3 — subscription.cancelled event
  // When user cancels their Pro subscription
  // ─────────────────────────────────────────────────────────
  describe("subscription.cancelled", () => {

    it("maps to subscription.cancelled type", () => {
      // ARRANGE
      const payload = {
        event_type: "subscription.cancelled",
        data: {
          id: "sub_456",
          subscription_id: "sub_456",
          custom_data: { atlassianId: "user_abc" },
        },
      };

      // ACT
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      expect(event.type).toBe("subscription.cancelled");
    });

    it("extracts atlassianId correctly on cancellation", () => {
      // ARRANGE
      const payload = {
        event_type: "subscription.cancelled",
        data: {
          id: "sub_456",
          subscription_id: "sub_456",
          custom_data: { atlassianId: "user_to_downgrade" },
        },
      };

      // ACT
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      // we need atlassianId to know WHO to downgrade
      expect(event.atlassianId).toBe("user_to_downgrade");
    });

    it("does NOT set expiresAt on cancellation", () => {
      // ARRANGE
      const payload = {
        event_type: "subscription.cancelled",
        data: {
          id: "sub_456",
          subscription_id: "sub_456",
          custom_data: { atlassianId: "user_abc" },
        },
      };

      // ACT
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      // cancelled subscription has no expiry date
      expect(event.expiresAt).toBeUndefined();
    });

  });

  // ─────────────────────────────────────────────────────────
  // GROUP 4 — Edge cases
  // Things that can go wrong in real life
  // ─────────────────────────────────────────────────────────
  describe("edge cases", () => {

    it("returns unknown type for unrecognized events", () => {
      // ARRANGE
      // Paddle might fire events we don't handle
      // e.g. address.created, customer.updated etc.
      const payload = {
        event_type: "address.created",
        data: {
          custom_data: { atlassianId: "user_abc" },
        },
      };

      // ACT
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      // we don't crash — just return unknown
      // PaymentService will ignore unknown events safely
      expect(event.type).toBe("unknown");
    });

    it("handles missing custom_data without crashing", () => {
      // ARRANGE
      // What if Paddle sends webhook without our custom_data?
      // This can happen if checkout was created without custom_data
      const payload = {
        event_type: "transaction.completed",
        data: {
          id: "txn_123",
          subscription_id: "sub_456",
          // no custom_data at all!
        },
      };

      // ACT — should NOT throw an error
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      // atlassianId is empty string — not undefined
      // PaymentService will handle this gracefully
      expect(event.atlassianId).toBe("");
    });

    it("handles missing subscription_id without crashing", () => {
      // ARRANGE
      const payload = {
        event_type: "transaction.completed",
        data: {
          id: "txn_123",
          // no subscription_id
          custom_data: { atlassianId: "user_abc" },
        },
      };

      // ACT
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      // falls back to transaction id or empty string
      expect(event.subscriptionId).toBeDefined();
    });

    it("handles completely empty data without crashing", () => {
      // ARRANGE
      // Worst case — Paddle sends us garbage
      const payload = {
        event_type: "transaction.completed",
        data: {},
      };

      // ACT — should NOT crash
      const event = normalizer.fromPaddle(payload);

      // ASSERT
      expect(event.atlassianId).toBe("");
      expect(event.subscriptionId).toBeDefined();
    });

  });

});