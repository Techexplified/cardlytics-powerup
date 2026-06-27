"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionController = void 0;
const UserService_1 = require("../services/UserService");
const logger_1 = require("../utils/logger");
class SubscriptionController {
    static async getStatus(req, res) {
        try {
            const { atlassianId } = req.user;
            await UserService_1.UserService.findOrCreate(atlassianId);
            const status = await UserService_1.UserService.getPlanStatus(atlassianId);
            res.status(200).json({
                plan: status.plan,
                expiresAt: status.expiresAt,
                isActive: status.isActive,
            });
        }
        catch (err) {
            logger_1.logger.error("Subscription Controller getStatus failed", {
                err: err.message,
                atlassianId: req.user?.atlassianId,
            });
            res.status(500).json({ error: "internal_error" });
        }
    }
}
exports.SubscriptionController = SubscriptionController;
//# sourceMappingURL=subscription.controller.js.map