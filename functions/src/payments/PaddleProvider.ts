// src/payments/PaddleProvider.ts
import * as crypto from "crypto";
import {
  PaymentProvider,
  SubscriptionStatus,
  CheckoutSession,  // 
} from "./PaymentProvider";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export class PaddleProvider extends PaymentProvider {

  // ── Called when user clicks Buy Pro ──────────────────
  async createCheckout(userId: string, plan: string): Promise<CheckoutSession> {
    const response = await fetch(
      "https://sandbox-api.paddle.com/transactions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              price_id: env.PADDLE_PRICE_ID,  // ← fix: price_id not product_id
              quantity: 1,
            },
          ],
          checkout: {
            url: "https://beautiful-concha-bf625c.netlify.app",     // 
          },
          custom_data: { atlassianId: userId },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      logger.error("Failed to create checkout session with Paddle", { data });
      throw new Error("Failed to create Paddle checkout session");
    }

    return {
      url: data.data.checkout.url,
      sessionId: data.data.id,
    };
  }

  // ── Verifies webhook is really from Paddle ───────────
verifyWebhook(rawBody: string, signature: string): boolean {
  try {
    // Paddle sends header like: "ts=1234567890;h1=abc123def456..."
    const parts = signature.split(";");
    const tsPart = parts.find((p) => p.startsWith("ts="));
    const h1Part = parts.find((p) => p.startsWith("h1="));

    if (!tsPart || !h1Part) {
      logger.warn("Invalid signature format", { signature });
      return false;
    }

    const ts = tsPart.split("=")[1];
    const h1 = h1Part.split("=")[1];

    // Paddle signs timestamp + ":" + rawBody together
    const signedPayload = `${ts}:${rawBody}`;

    const hmac = crypto.createHmac("sha256", env.PADDLE_WEBHOOK_SECRET);
    const expected = hmac.update(signedPayload).digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(h1)
    );
  } catch (err) {
    logger.error("Webhook signature verification failed", {
      err: (err as Error).message,
    });
    return false;
  }
}

  // ── Get subscription status from Paddle ──────────────
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    return { isActive: false };
  }
}