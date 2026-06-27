// src/config/env.ts
import { z } from "zod";

const schema = z.object({
  MONGO_URI: z.string().min(1),
  MONGO_DB_NAME: z.string().default("cardlytics"),
  PADDLE_WEBHOOK_SECRET: z.string().optional().default("placeholder"),
  PADDLE_API_KEY: z.string().optional().default("placeholder"),
  PADDLE_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  PAYMENT_PROVIDER: z.enum(["paddle", "razorpay", "dodo"]).default("paddle"),
  PADDLE_PRICE_ID: z.string().optional().default("placeholder"),
  
  TRELLO_API_KEY: z.string().min(1),
  ALLOWED_ORIGINS: z.string().default("https://trello.com"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Missing environment variables:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;