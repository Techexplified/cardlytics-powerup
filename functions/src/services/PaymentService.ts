// after the payment event.
// Calling UserService to update MongoDB.
// Completely provider-agnostic — only works with PaymentEvent.

import { PaymentEvent } from "../payments/WebhookNormalizer";
import { UserService } from "./UserService";
import { logger } from "../utils/logger";

export class PaymentService {
  // called from webhook controller after normalizing the event
  static async handleEvent(event: PaymentEvent): Promise<void> {
    // if unknown events then log and ignore safely

    if (event.type === "unknown") {
      logger.info("Received unknown payment event — ignoring", {
        atlassianId: event.atlassianId,
      });
      return;
    }

    // No atlassianId — can't update any user
    if (!event.atlassianId) {
      logger.error("Payment event missing atlassianId", { event });
      return;
    }

    if (event.type === "subscription.activated") {
      // Payment successful now upgrading user to Pro in DB

      await UserService.activatePro(
        event.atlassianId,
        event.expiresAt!,
        event.subscriptionId,
      );
      logger.info("user upgraded to Pro", {
        atlassianId: event.atlassianId,
        expiresAt: event.expiresAt,
      });
      return;
    }

    if (event.type === "payment.failed") {
      logger.warn("Payment failed", {
        atlassianId: event.atlassianId,
      });
      // user stays on free plan , no action needed
      // optionally in the future send email notification here later to the user

      return;
    }

    if (event.type === "subscription.cancelled") {
      // Subscription cancelled to downgradde user to Free

      await UserService.deactivatePro(event.atlassianId);
      logger.info("User downgraded to Free", {
        atlassianId: event.atlassianId,
      });
      return;
    }
  }
}
