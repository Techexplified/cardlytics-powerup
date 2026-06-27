/// <reference types="jest" />

jest.mock("../models/users", () => ({
  getUsersCollection: jest.fn(),
}));

import { UserService } from "../services/UserService";
import { getUsersCollection } from "../models/users";

describe("UserService", () => {
  // it will run before every single test and clears fake call history
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Group - 1 findOrCreate() testing  it will be called when power up loads for the first time

  describe("findOrCreate", () => {
    it("creates new users with the free plan if they don't exist", async () => {
      // if user doesn't exist in DB

      // This is the fake MongoDB collection we return
      // It has the same methods as a real MongoDB collection

      const mockInsertOne = jest.fn().mockResolvedValue({ insertId: "123" });
      (getUsersCollection as jest.Mock).mockResolvedValue({
        findOne: jest.fn().mockResolvedValue(null), // null = not found
        insertOne: mockInsertOne,
      });

      const result = await UserService.findOrCreate("new_user_123");
      expect(result.plan).toBe("free");
      expect(result.atlassianId).toBe("new_user_123");
      expect(mockInsertOne).toHaveBeenCalledTimes(1); // created the user in DB
    });

    it("returns existing user without inserting again", async () => {
      const mockInsertOne = jest.fn();
      (getUsersCollection as jest.Mock).mockResolvedValue({
        findOne: jest.fn().mockResolvedValue({
          atlassianId: "existing_user",
          plan: "free",
          created_at: new Date(),
          updated_at: new Date(),
        }),
        insertOne: mockInsertOne,
      });

      const result = await UserService.findOrCreate("exisiting_user");

      expect(result.atlassianId).toBe("existing_user");
      expect(mockInsertOne).not.toHaveBeenCalled(); // user not inserted
    });
  });

  // STEP 2 — getPlanStatus()
  // it decides user is Free or Pro on every Power-Up load

  describe("getPlanStatus", () => {
    it("returns free if user does not exist in MongoDb", async () => {
      (getUsersCollection as jest.Mock).mockResolvedValue({
        findOne: jest.fn().mockResolvedValue(null),
        updateOne: jest.fn(),
      });

      const result = await UserService.getPlanStatus("unknow_id");
      expect(result.plan).toBe("free");
      expect(result.isActive).toBe(false);
    });

    it("returns free if user has free plan", async () => {
      // user exist but never paid
      (getUsersCollection as jest.Mock).mockResolvedValue({
        findOne: jest.fn().mockResolvedValue({
          atlassianId: "free_user",
          plan: "free",
        }),
        updateOne: jest.fn(),
      });

      const result = await UserService.getPlanStatus("free_user");

      expect(result.plan).toBe("free");
      expect(result.isActive).toBe(false);
    });

    it("returns pro if plan is pro AND expiry is in the future", async () => {
      // user paid and subs active
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      (getUsersCollection as jest.Mock).mockResolvedValue({
        findOne: jest.fn().mockResolvedValue({
          atlassianId: "pro_user",
          plan: "pro",
          plan_expires_at: futureDate,
        }),
        updateOne: jest.fn(),
      });
      const result = await UserService.getPlanStatus("pro_user");

      expect(result.plan).toBe("pro");
      expect(result.isActive).toBe(true);
      expect(result.expiresAt).toBeDefined();
    });

    it("returns free and updates DB if pro plan has expired", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const mockUpdateOne = jest.fn().mockResolvedValue({});

      (getUsersCollection as jest.Mock).mockResolvedValue({
        findOne: jest.fn().mockResolvedValue({
          atlassianId: "expired_user",
          plan: "pro",
          plan_expires_at: pastDate,
        }),
        updateOne: mockUpdateOne,
      });

      const result = await UserService.getPlanStatus("expired_user");

      expect(result.plan).toBe("free");
      expect(result.isActive).toBe(false);

      // MongoDB must be updated to free — very important

      expect(mockUpdateOne).toHaveBeenCalledTimes(1);
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { atlassianId: "expired_user" },
        expect.objectContaining({
          $set: expect.objectContaining({ plan: "free" }),
        }),
      );
    });
  });

  // step 3 — activatePro()
  // Called by PaymentService after webhook arrives
  // Upgrades user to Pro in MongoDB

  describe("activatePro", () => {
    it("update mongoDb with pro plan expiry and subscription id", async () => {
      const mockFindOneAndUpdate = jest.fn().mockResolvedValue({});
      (getUsersCollection as jest.Mock).mockResolvedValue({
        findOneAndUpdate: mockFindOneAndUpdate,
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await UserService.activatePro(
        "user_to_upgrade",
        expiresAt,
        "sub_paddle_123",
      );

   
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { atlassianId: "user_to_upgrade" },
        expect.objectContaining({
          $set: expect.objectContaining({
            plan: "pro",
            plan_expires_at: expiresAt,
            paddle_subscription_id: "sub_paddle_123",
          }),
        }),
        { upsert: true }
      );
    });
  });

  // step 4 — deactivatePro()
  // Called when subscription is cancelled
  // Downgrades user back to free

  describe("deactivatePro", () => {
    it("sets plan back to free in MongoDB", async () => {
      const mockUpdateOne = jest.fn().mockResolvedValue({});
      (getUsersCollection as jest.Mock).mockResolvedValue({
        updateOne: mockUpdateOne,
      });

      await UserService.deactivatePro("user_who_cancelled");
      expect(mockUpdateOne).toHaveBeenCalledTimes(1);
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { atlassianId: "user_who_cancelled" },
        expect.objectContaining({
          $set: expect.objectContaining({ plan: "free" }),
        }),
      );
    });
  });
});
