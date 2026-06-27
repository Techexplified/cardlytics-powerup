import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { logger } from "../utils/logger";

export class SubscriptionController {
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { atlassianId, email, displayName } = req.user!;
      await UserService.findOrCreate(atlassianId, email, displayName);
      const status = await UserService.getPlanStatus(atlassianId);

      res.status(200).json({
        plan: status.plan,
        expiresAt: status.expiresAt,
        isActive: status.isActive,
      });
    } catch (err) {
      logger.error("Subscription Controller getStatus failed", {
        err: (err as Error).message,
        atlassianId: req.user?.atlassianId,
      });
      res.status(500).json({ error: "internal_error" });
    }
  }
}
