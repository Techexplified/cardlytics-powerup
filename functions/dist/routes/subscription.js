"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/subscription.ts
const express_1 = require("express");
const subscription_controller_1 = require("../controllers/subscription.controller");
const subscriptionRouter = (0, express_1.Router)();
// GET /api/subscription/status
subscriptionRouter.get("/status", subscription_controller_1.SubscriptionController.getStatus);
exports.default = subscriptionRouter;
//# sourceMappingURL=subscription.js.map