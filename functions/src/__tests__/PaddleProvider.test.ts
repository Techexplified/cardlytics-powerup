// functions/src/__tests__/PaddleProvider.test.ts

// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
// verifyWebhook() is your security gate for payments.
// If this is wrong:
// - Fake webhooks can upgrade anyone to Pro for free
// - Attackers can cancel real users subscriptions
// - Your entire payment system can be manipulated
//
// So we test every possible signature scenario.
// ─────────────────────────────────────────────────────────────

import * as crypto from "crypto";

// Mock env BEFORE importing PaddleProvider
// We use a known test secret so we can generate
// correct signatures in our tests
jest.mock("../config/env", () => ({
  env: {
    PADDLE_WEBHOOK_SECRET: "test_webhook_secret_123",
    PADDLE_API_KEY:        "test_api_key",
    PADDLE_PRICE_ID:       "pri_test_123",
    PADDLE_ENVIRONMENT:    "sandbox",
  },
}));

import { PaddleProvider } from "../payments/PaddleProvider";

// ── Helper function ───────────────────────────────────────────
// Generates a VALID Paddle signature for a given body
// This is what Paddle does on their side before sending webhook
// We use the same logic here to create test signatures
function generateValidSignature(body: string, ts: string): string {
  const secret = "test_webhook_secret_123";
  // Paddle signs: timestamp + ":" + body
  const signedPayload = `${ts}:${body}`;
  const hmac = crypto.createHmac("sha256", secret);
  const h1 = hmac.update(signedPayload).digest("hex");
  // Paddle sends: "ts=TIMESTAMP;h1=HASH"
  return `ts=${ts};h1=${h1}`;
}

// Create one provider instance — reused in all tests
const provider = new PaddleProvider();

describe("PaddleProvider.verifyWebhook", () => {

  // ─────────────────────────────────────────────────────────
  // GROUP 1 — Valid signatures
  // These should all return TRUE
  // ─────────────────────────────────────────────────────────
  describe("valid signatures", () => {

    it("returns true for a correctly signed webhook", () => {
      // ARRANGE
      const body = JSON.stringify({
        event_type: "transaction.completed",
        data: { custom_data: { atlassianId: "user_abc" } }
      });
      const ts = String(Math.floor(Date.now() / 1000));
      const signature = generateValidSignature(body, ts);

      // ACT
      const result = provider.verifyWebhook(body, signature);

      // ASSERT — valid signature must return true
      expect(result).toBe(true);
    });

    it("returns true for subscription.cancelled event", () => {
      // ARRANGE — different event type, same verification logic
      const body = JSON.stringify({
        event_type: "subscription.cancelled",
        data: { subscription_id: "sub_123" }
      });
      const ts = String(Math.floor(Date.now() / 1000));
      const signature = generateValidSignature(body, ts);

      // ACT
      const result = provider.verifyWebhook(body, signature);

      // ASSERT
      expect(result).toBe(true);
    });

  });

  // ─────────────────────────────────────────────────────────
  // GROUP 2 — Invalid signatures
  // These should all return FALSE
  // An attacker trying to fake a webhook
  // ─────────────────────────────────────────────────────────
  describe("invalid signatures", () => {

    it("returns false when webhook secret is wrong", () => {
      // ARRANGE
      // Attacker uses wrong secret to sign
      const body = JSON.stringify({ event_type: "transaction.completed" });
      const ts = String(Math.floor(Date.now() / 1000));

      // sign with WRONG secret
      const wrongSecret = "i_am_an_attacker";
      const hmac = crypto.createHmac("sha256", wrongSecret);
      const h1 = hmac.update(`${ts}:${body}`).digest("hex");
      const fakeSignature = `ts=${ts};h1=${h1}`;

      // ACT
      const result = provider.verifyWebhook(body, fakeSignature);

      // ASSERT — must reject this
      expect(result).toBe(false);
    });

    it("returns false when body has been tampered with", () => {
      // ARRANGE
      // Attacker signs original body but sends different body
      const originalBody = JSON.stringify({
        event_type: "transaction.completed",
        data: { custom_data: { atlassianId: "user_abc" } }
      });
      const ts = String(Math.floor(Date.now() / 1000));
      // generate valid signature for original body
      const signature = generateValidSignature(originalBody, ts);

      // Attacker changes the body AFTER signing
      const tamperedBody = JSON.stringify({
        event_type: "transaction.completed",
        data: { custom_data: { atlassianId: "different_user" } }
      });

      // ACT — send tampered body with original signature
      const result = provider.verifyWebhook(tamperedBody, signature);

      // ASSERT — tampered body must be rejected
      expect(result).toBe(false);
    });

    it("returns false when signature header is empty", () => {
      // ARRANGE
      const body = JSON.stringify({ event_type: "transaction.completed" });

      // ACT — empty signature
      const result = provider.verifyWebhook(body, "");

      // ASSERT
      expect(result).toBe(false);
    });

    it("returns false when signature format is wrong", () => {
      // ARRANGE
      const body = JSON.stringify({ event_type: "transaction.completed" });

      // ACT — completely wrong format (not ts=...;h1=...)
      const result = provider.verifyWebhook(body, "invalid_signature_format");

      // ASSERT
      expect(result).toBe(false);
    });

    it("returns false when h1 hash is missing", () => {
      // ARRANGE
      const body = JSON.stringify({ event_type: "transaction.completed" });
      const ts = String(Math.floor(Date.now() / 1000));

      // ACT — has ts but no h1
      const result = provider.verifyWebhook(body, `ts=${ts}`);

      // ASSERT
      expect(result).toBe(false);
    });

    it("returns false when ts is missing", () => {
      // ARRANGE
      const body = JSON.stringify({ event_type: "transaction.completed" });

      // ACT — has h1 but no ts
      const result = provider.verifyWebhook(body, "h1=abc123def456");

      // ASSERT
      expect(result).toBe(false);
    });

    it("returns false when body is empty", () => {
      // ARRANGE
      const ts = String(Math.floor(Date.now() / 1000));
      const signature = generateValidSignature("", ts);

      // ACT — valid signature but for empty body
      // real body is not empty so it won't match
      const result = provider.verifyWebhook(
        JSON.stringify({ event_type: "transaction.completed" }),
        signature
      );

      // ASSERT
      expect(result).toBe(false);
    });

  });

});