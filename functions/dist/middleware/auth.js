"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const logger_1 = require("../utils/logger");
const tokenCache = new Map();
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "missing_token" });
    }
    const token = authHeader.split(" ")[1];
    // Check cache first - valid for 60 sec
    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
        req.user = { atlassianId: cached.atlassianId };
        return next();
    }
    try {
        // Verify token with Trello API
        const res2 = await fetch(`https://api.trello.com/1/members/me?key=${process.env.TRELLO_API_KEY}&token=${token}`);
        if (!res2.ok)
            return res.status(401).json({ error: "invalid_token" });
        const member = await res2.json();
        const atlassianId = member.id; // stable Trello member ID
        tokenCache.set(token, { atlassianId, expiresAt: Date.now() + 60000 }); // cache for 60 sec
        req.user = { atlassianId };
        return next();
    }
    catch (err) {
        logger_1.logger.error("Auth middleware failed", { err });
        return res.status(401).json({ error: "auth_failed" });
    }
}
//# sourceMappingURL=auth.js.map