// src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { authMiddleware } from "./middleware/auth";
import subscriptionRouter from "./routes/subscription";
import { createUserIndexes } from "./models/users";
import checkoutRouter from "./routes/checkout";
import webhookRouter from "./routes/webhook";

const app = express();

app.use(helmet());

const allowedOrigins = env.ALLOWED_ORIGINS
  .split(",")
  .map(origin => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      console.log("Incoming origin:", origin);

      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(`Blocked origin: ${origin}`);

      return callback(new Error(`Blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);



// ── Capture raw body for ALL requests 
// This is the most reliable way with Firebase emulator

app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf; // captures raw bytes before parsing
    },
  })
);

createUserIndexes().catch((err) =>
  console.error("Failed to create indexes", err)
);

app.get("/health", (req, res) => res.json({ status: "ok" }));

// ── Routes ───────────────────────────────────────────
app.use("/webhooks", webhookRouter);        // 2 payment url generate and verify the user
app.use("/api/subscription", authMiddleware, subscriptionRouter); // 1 verify user is pro or free 
app.use("/api/checkout", authMiddleware, checkoutRouter);  //3 checkout once the payment is successffull 

export default app;