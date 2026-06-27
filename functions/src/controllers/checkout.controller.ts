import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { getPaymentProvider } from "../payments";
import { logger } from "../utils/logger";

export class CheckoutController {
  // POST /api/checkout/init
  static async initCheckout(req: Request, res: Response): Promise<void> {
    try {
      const { atlassianId } = req.user!;

      // Guard : already pro?
      // Don't create a new checkout if user already paid
      const status = await UserService.getPlanStatus(atlassianId);
      if (status.isActive) {
        res.status(409).json({ error: "already_pro" });
      }

      // create checkout session
      const provider = getPaymentProvider();
      const session = await provider.createCheckout(atlassianId, "pro");

      logger.info("checkout session created", { atlassianId });

      // Return checkout URL to Power-Up
      // power up opens this url in paddle overlay

      res.json({
        checkoutUrl: session.url,
      });
    } catch (err) {
      logger.error("CheckoutController.initCheckout failed", {
        err: (err as Error).message,
        atlassianId: req.user?.atlassianId,
      });
      res.status(500).json({ error: "internal_error" });
    }
  }
}
