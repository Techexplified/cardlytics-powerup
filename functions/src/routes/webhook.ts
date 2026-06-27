// src/routes/webhook.ts
import { Router } from "express";
import { WebhookController } from "../controllers/webhook.controller";

const webhookRouter = Router();
// POST /webhooks/paddle
// NO authMiddleware , Paddle calls this directly
webhookRouter.post("/paddle", WebhookController.handlePaddle);

export default webhookRouter;