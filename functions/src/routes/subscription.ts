// src/routes/subscription.ts
import { Router } from "express";
import { SubscriptionController } from "../controllers/subscription.controller";

const subscriptionRouter = Router();

// GET /api/subscription/status
subscriptionRouter.get("/status", SubscriptionController.getStatus);

export default subscriptionRouter;