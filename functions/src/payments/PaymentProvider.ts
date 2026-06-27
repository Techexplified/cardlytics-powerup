// What creatCheckout() returns
export interface CheckoutSession {
  url: string; // paddle checkout page url
  sessionId: string; // paddle transaction id
}

// What getSubscriptionStatus() returns
export interface SubscriptionStatus {
  isActive: boolean;
  expiresAt?: Date;
}

// Abstract class — defines the contract
// Every provider MUST implement these 3 methods
export abstract class PaymentProvider {
  // called when user click Buy pro
  abstract createCheckout(
    userId: string,
    plan: string,
  ): Promise<CheckoutSession>;

  // Called when webhook arrives — verify it's really from Paddle
  abstract verifyWebhook(rawBody: string, signature: string): boolean;

  // Called to check subscription status directly from Paddle
  abstract getSubscriptionStatus(userId: string): Promise<SubscriptionStatus>;
}
