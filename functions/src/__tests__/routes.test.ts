
jest.mock("../config/env", () => ({
  env: {
    MONGO_URI:              "mongodb://fake",
    MONGO_DB_NAME:          "cardlytics_test",
    PADDLE_WEBHOOK_SECRET:  "test_secret",
    PADDLE_API_KEY:         "test_api_key",
    PADDLE_PRICE_ID:        "pri_test_123",
    PADDLE_ENVIRONMENT:     "sandbox",
    PAYMENT_PROVIDER:       "paddle",
    TRELLO_API_KEY:         "test_trello_key",
    ALLOWED_ORIGINS:        "http://localhost:5000",
    NODE_ENV:               "test",
  },
}));

// ── Mock db SECOND — before app loads ─────────────────────────
// app.ts calls createUserIndexes on startup
// which tries to connect to MongoDB
// We mock this to prevent real DB connection
jest.mock("../config/db", () => ({
  getDb: jest.fn().mockResolvedValue({
    collection: jest.fn().mockReturnValue({}),
  }),
}));

// ── Mock MongoDB models ────────────────────────────────────
jest.mock("../models/users", () => ({
  getUsersCollection: jest.fn(),
  createUserIndexes: jest.fn().mockResolvedValue(undefined),
}));

// ── Mock auth middleware ───────────────────────────────────────
jest.mock("../middleware/auth", () => ({
  authMiddleware: jest.fn((req: any, res: any, next: any) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "missing_token" });
    }
    const token = auth.split(" ")[1];
    if (token === "invalid_token") {
      return res.status(401).json({ error: "invalid_token" });
    }
    req.user = { atlassianId: "test_user_123" };
    next();
  }),
}));

// ── Mock UserService ───────────────────────────────────────────
jest.mock("../services/UserService", () => ({
  UserService: {
    findOrCreate: jest.fn(),
    getPlanStatus: jest.fn(),
    activatePro: jest.fn(),
    deactivatePro: jest.fn(),
    clearPlanCache: jest.fn(),
  },
}));

// ── Mock payment provider ──────────────────────────────────────
jest.mock("../payments", () => ({
  getPaymentProvider: jest.fn(() => ({
    createCheckout: jest.fn().mockResolvedValue({
      url: "https://sandbox-checkout.paddle.com/checkout/test123",
      sessionId: "txn_test_123",
    }),
    verifyWebhook: jest.fn().mockReturnValue(true),
  })),
}));

// ── NOW import app — all mocks are ready ──────────────────────
import request from "supertest";
import app from "../app";
import { UserService } from "../services/UserService";

describe("API Routes", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // GROUP 1 — Health check
  // ─────────────────────────────────────────────────────────
  describe("GET /health", () => {

    it("returns 200 with status ok", async () => {
      const response = await request(app).get("/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });

  });

  // ─────────────────────────────────────────────────────────
  // GROUP 2 — GET /api/subscription/status
  // ─────────────────────────────────────────────────────────
  describe("GET /api/subscription/status", () => {

    it("returns 401 when no token provided", async () => {
      const response = await request(app)
        .get("/api/subscription/status");
      expect(response.status).toBe(401);
      expect(response.body.error).toBe("missing_token");
    });

    it("returns 401 when token is invalid", async () => {
      const response = await request(app)
        .get("/api/subscription/status")
        .set("Authorization", "Bearer invalid_token");
      expect(response.status).toBe(401);
      expect(response.body.error).toBe("invalid_token");
    });

    it("returns free plan for new user", async () => {
      (UserService.findOrCreate as jest.Mock).mockResolvedValue({
        atlassianId: "test_user_123",
        plan: "free",
        created_at: new Date(),
        updated_at: new Date(),
      });
      (UserService.getPlanStatus as jest.Mock).mockResolvedValue({
        plan: "free",
        isActive: false,
        expiresAt: null,
      });

      const response = await request(app)
        .get("/api/subscription/status")
        .set("Authorization", "Bearer valid_test_token");

      expect(response.status).toBe(200);
      expect(response.body.plan).toBe("free");
      expect(response.body.isActive).toBe(false);
    });

    it("returns pro plan for paying user", async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      (UserService.findOrCreate as jest.Mock).mockResolvedValue({
        atlassianId: "test_user_123",
        plan: "pro",
      });
      (UserService.getPlanStatus as jest.Mock).mockResolvedValue({
        plan: "pro",
        isActive: true,
        expiresAt,
      });

      const response = await request(app)
        .get("/api/subscription/status")
        .set("Authorization", "Bearer valid_test_token");

      expect(response.status).toBe(200);
      expect(response.body.plan).toBe("pro");
      expect(response.body.isActive).toBe(true);
      expect(response.body.expiresAt).toBeDefined();
    });

  });

  // ─────────────────────────────────────────────────────────
  // GROUP 3 — POST /api/checkout/init
  // ─────────────────────────────────────────────────────────
  describe("POST /api/checkout/init", () => {

    it("returns 401 when no token provided", async () => {
      const response = await request(app)
        .post("/api/checkout/init");
      expect(response.status).toBe(401);
    });

    it("returns 409 if user is already Pro", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      (UserService.getPlanStatus as jest.Mock).mockResolvedValue({
        plan: "pro",
        isActive: true,
        expiresAt: futureDate,
      });

      const response = await request(app)
        .post("/api/checkout/init")
        .set("Authorization", "Bearer valid_test_token");

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("already_pro");
    });

    it("returns checkoutUrl for free user", async () => {
      (UserService.getPlanStatus as jest.Mock).mockResolvedValue({
        plan: "free",
        isActive: false,
      });

      const response = await request(app)
        .post("/api/checkout/init")
        .set("Authorization", "Bearer valid_test_token");

      expect(response.status).toBe(200);
      expect(response.body.checkoutUrl).toBeDefined();
      expect(response.body.checkoutUrl).toContain("paddle");
    });

  });

  // ─────────────────────────────────────────────────────────
  // GROUP 4 — POST /webhooks/paddle
  // ─────────────────────────────────────────────────────────
  describe("POST /webhooks/paddle", () => {

    it("returns 401 when no signature", async () => {
      const response = await request(app)
        .post("/webhooks/paddle")
        .send({ event_type: "transaction.completed" });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("missing_signature");
    });

    it("returns 200 with received true for valid webhook", async () => {
      (UserService.activatePro as jest.Mock).mockResolvedValue(undefined);

      const body = JSON.stringify({
        event_type: "transaction.completed",
        data: {
          id: "txn_123",
          subscription_id: "sub_456",
          custom_data: { atlassianId: "test_user_123" },
        },
      });

      const response = await request(app)
        .post("/webhooks/paddle")
        .set("Content-Type", "application/json")
        .set("paddle-signature", "ts=123456;h1=validhash")
        .send(body);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

  });

});