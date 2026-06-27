"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
// src/config/env.ts
const zod_1 = require("zod");
const schema = zod_1.z.object({
    MONGO_URI: zod_1.z.string().min(1),
    MONGO_DB_NAME: zod_1.z.string().default("cardlytics"),
    PADDLE_WEBHOOK_SECRET: zod_1.z.string().min(1),
    PADDLE_API_KEY: zod_1.z.string().min(1),
    PADDLE_ENVIRONMENT: zod_1.z.enum(["sandbox", "production"]).default("sandbox"),
    PAYMENT_PROVIDER: zod_1.z.enum(["paddle", "razorpay", "dodo"]).default("paddle"),
    TRELLO_API_KEY: zod_1.z.string().min(1),
    ALLOWED_ORIGINS: zod_1.z.string().default("https://trello.com"),
    NODE_ENV: zod_1.z
        .enum(["development", "production", "test"])
        .default("development"),
});
// This runs once at cold start — crashes immediately if a secret is missing
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error("❌ Missing environment variables:", parsed.error.format());
    process.exit(1); // kills the function cold start with a clear log
}
exports.env = parsed.data;
//# sourceMappingURL=env.js.map