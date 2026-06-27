// Internal event shape — provider agnostic

export interface PaymentEvent {
  type:
    | "subscription.activated"
    | "subscription.cancelled"
    | "payment.failed"
    | "unknown";

  atlassianId: string;
  subscriptionId: string;
  expiresAt?: Date;
}

export class WebhookNormalizer {
  // Now i'm going to map paddle webhook payload to my payment event interface

  fromPaddle(payload: any): PaymentEvent {
    const eventType = payload.event_type;
    const data = payload.data;

    // Extracting atlassianId we stored in custom_data during checkout

    const atlassianId = data?.custom_data?.atlassianId || "";
    const subscriptionId = data?.subscription_id || data?.id || "";

    //Now mapping event types to our internal types
    if (
      eventType === "transaction.completed" ||
      eventType === "subscription.activated"
    ) {
      // now calculating the expire data , 30 days from now for monthly plan

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      return {
        type: "subscription.activated",
        atlassianId,
        subscriptionId,
        expiresAt,
      };
    }

    if (eventType === "transaction.payment_failed") {
      return {
        type: "payment.failed",
        atlassianId,
        subscriptionId,
      };
    }

    if (
      eventType === "subscription.cancelled" ||
      eventType === "subscription.paused"
    ) {
      return {
        type: "subscription.cancelled",
        atlassianId,
        subscriptionId,
      };
    }

    return {
      type: "unknown",
      atlassianId,
      subscriptionId,
    };
  }
}
