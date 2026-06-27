"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const auth_1 = require("./middleware/auth");
const subscription_1 = __importDefault(require("./routes/subscription"));
const users_1 = require("./models/users");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
// Middleware
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = env_1.env.ALLOWED_ORIGINS.split(",");
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`Blocked origin: ${origin}`));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
(0, users_1.createUserIndexes)().catch((err) => console.error("Failed to create indexes", err));
// Test route
app.get("/", (req, res) => {
    res.send("Cardlytics Backend Running");
});
// ── Health check ─────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));
// ── Routes
app.use("/api/subscription", auth_1.authMiddleware, subscription_1.default);
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=app.js.map