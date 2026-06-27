import { Request, Response } from "express";
import { getPaymentProvider } from "../payments";
import { WebhookNormalizer } from "../payments/WebhookNormalizer";
import { PaymentService } from "../services/PaymentService";
import { logger } from "../utils/logger";

const normalizer = new WebhookNormalizer();

export class WebhookController {
  // POST /webhooks/paddle
  // PUBLIC route , no authMiddleware
  // Paddle calls this after every payment event

  static async handlePaddle(req: Request, res: Response): Promise<void> {
    try {
      // getting the raw body for signature verification
      const rawBody = req.rawBody?.toString("utf8") || "";
      const signature = req.headers["paddle-signature"] as string;

      if (!signature) {
        logger.warn("Webhook received without signature");
        res.status(401).json({ error: "missing_signature" });
        return;
      }

      // now verifying the signature - is this really paddle ?
      const provider = getPaymentProvider();
      const isValid = provider.verifyWebhook(rawBody, signature);

      if (!isValid) {
        logger.warn("Invalid webhook signature", { ip: req.ip });
        res.status(401).json({ error: "invalid_signature" });
        return;
      }

      //  Parsing and normalize the payload
      const payload = JSON.parse(rawBody);
      logger.info("Webhook received", { eventType: payload.event_type });

      const event = normalizer.fromPaddle(payload);

      //Handle the event
      await PaymentService.handleEvent(event);

      // returning 200 within 5s
      // If we don't, Paddle retries the webhook

      res.status(200).json({ received: true });
    } catch (err) {
      logger.error("WebhookController.handlePaddle failed", {
        err: (err as Error).message,
      });
      res.status(200).json({ received: true });
    }
  }
}
