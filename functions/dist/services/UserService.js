"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const users_1 = require("../models/users");
const logger_1 = require("../utils/logger");
// Called on every app load
// If user doesn't exist yet → create them as free
// If user exists → return their current data
class UserService {
    static async findOrCreate(atlassianId) {
        const col = await (0, users_1.getUsersCollection)();
        const existing = await col.findOne({ atlassianId });
        if (existing)
            return existing;
        // first time user open cardyltics.
        const newUser = {
            atlassianId,
            plan: "free",
            created_at: new Date(),
            updated_at: new Date(),
        };
        await col.insertOne(newUser);
        logger_1.logger.info(`New user created: ${atlassianId}`);
        return newUser;
    }
    // check plan status
    // pro = plan is active AND expired yet
    static async getPlanStatus(atlassianId) {
        const col = await (0, users_1.getUsersCollection)();
        const user = await col.findOne({ atlassianId });
        // User not in DB at all → treat as free
        if (!user) {
            return { plan: "free", isActive: false };
        }
        if (user.plan === "pro" &&
            user.plan_expires_at &&
            user.plan_expires_at < new Date()) {
            await col.updateOne({ atlassianId }, {
                $set: {
                    plan: "free",
                    updated_at: new Date(),
                },
            });
            return { plan: "free", isActive: false };
        }
        return {
            plan: user.plan,
            expiresAt: user.plan_expires_at,
            isActive: user.plan === "pro",
        };
    }
    // Called from webhook handler after payment
    static async activatePro(atlassianId, expiresAt, paddleSubscriptionId) {
        const col = await (0, users_1.getUsersCollection)();
        await col.updateOne({ atlassianId }, {
            $set: {
                plan: "pro",
                plan_expires_at: expiresAt,
                paddle_subscription_id: paddleSubscriptionId,
                updated_at: new Date(),
            },
        }, { upsert: true });
        logger_1.logger.info("pro plan activated", { atlassianId, expiresAt });
    }
    //Called from webhook on cancellation/refund
    static async deactivatePro(atlassianId) {
        const col = await (0, users_1.getUsersCollection)();
        await col.updateOne({ atlassianId }, {
            $set: {
                plan: "free",
                plan_expires_at: undefined,
                updated_at: new Date(),
            },
        });
        logger_1.logger.info("pro plan deactivated", { atlassianId });
    }
}
exports.UserService = UserService;
//# sourceMappingURL=UserService.js.map