// src/services/UserService.ts
import { getUsersCollection, UserDocument } from "../models/users";
import { logger } from "../utils/logger";

// ── Plan cache ────────────────────────────────────────────────
// Stores plan status in memory for 60 seconds
// So 1000 users loading Power-Up = ~1 MongoDB query per user
// instead of 1000 queries every single time
const planCache = new Map<string, {
  result: { plan: "free" | "pro"; isActive: boolean; expiresAt?: Date };
  cachedAt: number;
}>();

const CACHE_TTL = 60 * 1000; // 60 seconds

export class UserService {

  // ── findOrCreate ──────────────────────────────────────────
  // Called on every app load
  // If user doesn't exist yet → create them as free
  // If user exists → return their current data
  static async findOrCreate(
    atlassianId: string,
    email?: string,
    displayName?: string,
  ): Promise<UserDocument> {
    const col = await getUsersCollection();
    const existing = await col.findOne({ atlassianId });
    if (existing) return existing;

    const newUser: UserDocument = {
      atlassianId,
      email: email || "",
      displayName: displayName || "",
      plan: "free",
      created_at: new Date(),
      updated_at: new Date(),
    };
    await col.insertOne(newUser);
    logger.info(`New user created: ${atlassianId}`);
    return newUser;
  }

  // ── getPlanStatus ─────────────────────────────────────────
  // Called every time Power-Up loads
  // Checks cache first — only hits MongoDB if cache is empty
  static async getPlanStatus(
    atlassianId: string,
  ): Promise<{ plan: "free" | "pro"; expiresAt?: Date; isActive: boolean }> {

    // ── Step 1: Check cache ──────────────────────────────
    // If we checked this user's plan less than 60 seconds ago
    // return the cached result immediately — no DB query
    const cached = planCache.get(atlassianId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.result; // ← instant return, no MongoDB
    }

    // ── Step 2: Cache miss — query MongoDB ───────────────
    const col = await getUsersCollection();
    const user = await col.findOne({ atlassianId });

    // User not in DB at all → free
    if (!user) {
      const result = { plan: "free" as const, isActive: false };
      // cache this result too
      planCache.set(atlassianId, { result, cachedAt: Date.now() });
      return result;
    }

    // Pro plan expired → downgrade to free
    if (
      user.plan === "pro" &&
      user.plan_expires_at &&
      user.plan_expires_at < new Date()
    ) {
      await col.updateOne(
        { atlassianId },
        { $set: { plan: "free", updated_at: new Date() } }
      );
      const result = { plan: "free" as const, isActive: false };
      // cache the downgraded result
      planCache.set(atlassianId, { result, cachedAt: Date.now() });
      return result;
    }

    // ── Step 3: Build result and cache it ────────────────
    const result = {
      plan: user.plan,
      expiresAt: user.plan_expires_at,
      isActive: user.plan === "pro",
    };
    planCache.set(atlassianId, { result, cachedAt: Date.now() });
    return result;
  }

  // ── clearPlanCache ────────────────────────────────────────
  // Called after plan changes so next check hits MongoDB fresh
  static clearPlanCache(atlassianId: string): void {
    planCache.delete(atlassianId);
    logger.info("plan cache cleared", { atlassianId });
  }

  // ── activatePro ───────────────────────────────────────────
  // Called from webhook handler after payment
  static async activatePro(
    atlassianId: string,
    expiresAt: Date,
    paddleSubscriptionId: string,
  ): Promise<void> {
    const col = await getUsersCollection();
    await col.findOneAndUpdate(
      { atlassianId },
      {
        $set: {
          plan: "pro",
          plan_expires_at: expiresAt,
          paddle_subscription_id: paddleSubscriptionId,
          updated_at: new Date(),
        },
      },
      { upsert: true },
    );

    // ← clear cache so next status check reads fresh from DB
    UserService.clearPlanCache(atlassianId);
    logger.info("pro plan activated", { atlassianId, expiresAt });
  }

  // ── deactivatePro ─────────────────────────────────────────
  // Called from webhook on cancellation/refund
  static async deactivatePro(atlassianId: string): Promise<void> {
    const col = await getUsersCollection();
    await col.updateOne(
      { atlassianId },
      {
        $set: {
          plan: "free",
          plan_expires_at: undefined,
          updated_at: new Date(),
        },
      },
    );

    // ← clear cache so next status check reads fresh from DB
    UserService.clearPlanCache(atlassianId);
    logger.info("pro plan deactivated", { atlassianId });
  }
}