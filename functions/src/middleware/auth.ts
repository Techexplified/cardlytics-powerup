import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

// Extend Express Request type to carry user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        atlassianId: string;
        email?: string;
        displayName?: string;
      };
    }
  }
}

const tokenCache = new Map<
  string,
  { atlassianId: string; email: string; displayName: string; expiresAt: number }
>();

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing_token" });
  }

  const token = authHeader.split(" ")[1];

  // Check cache first - valid for 60 sec
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    req.user = {
      atlassianId: cached.atlassianId,
      email: cached.email,
      displayName: cached.displayName,
    };
    return next();
  }

  try {
    // Verify token with Trello API
    const res2 = await fetch(
      `https://api.trello.com/1/members/me?key=${process.env.TRELLO_API_KEY}&token=${token}`,
    );
    if (!res2.ok) return res.status(401).json({ error: "invalid_token" });
    const member = await res2.json();
    const atlassianId = member.id; // stable Trello member ID
    const email = member.email || ""; // ← grab email
    const displayName = member.fullName || ""; // ← grab name

    tokenCache.set(token, {
      atlassianId,
      email,
      displayName,
     expiresAt: Date.now() + 5 * 60 * 1000,
    }); // cache for 60 sec
    req.user = { atlassianId, email, displayName  };
    return next();
  } catch (err) {
    logger.error("Auth middleware failed", { err });
    return res.status(401).json({ error: "auth_failed" });
  }
}
