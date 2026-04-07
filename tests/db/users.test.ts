import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser } from "../helpers/setup";
import {
  findUserByAddress,
  createUser,
  getUserWithAddresses,
  findUserByName,
  getAllUsers,
} from "../../src/db/users";

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe("findUserByAddress", () => {
  it("returns user when address exists", async () => {
    await createTestUser({ addresses: [{ channel: "sms", address: "+15559876543" }] });
    const user = await findUserByAddress("+15559876543");
    expect(user).not.toBeNull();
    expect(user?.addresses.some((a) => a.address === "+15559876543")).toBe(true);
  });

  it("returns null when address does not exist", async () => {
    const user = await findUserByAddress("+10000000000");
    expect(user).toBeNull();
  });
});

describe("createUser", () => {
  it("creates a user with addresses", async () => {
    const user = await createUser({
      name: "Alice",
      role: "admin",
      preferredChannel: "email",
      addresses: [{ channel: "email", address: "alice@example.com" }],
    });
    expect(user.name).toBe("Alice");
    expect(user.role).toBe("admin");
    expect(user.preferredChannel).toBe("email");
    expect(user.addresses).toHaveLength(1);
    expect(user.addresses[0].address).toBe("alice@example.com");
  });

  it("creates a user with multiple addresses", async () => {
    const user = await createUser({
      name: "Bob",
      role: "member",
      preferredChannel: "sms",
      addresses: [
        { channel: "sms", address: "+15550001111" },
        { channel: "email", address: "bob@example.com" },
      ],
    });
    expect(user.addresses).toHaveLength(2);
  });
});

describe("getUserWithAddresses", () => {
  it("returns user with addresses by id", async () => {
    const created = await createTestUser({ name: "Charlie" });
    const user = await getUserWithAddresses(created.id);
    expect(user).not.toBeNull();
    expect(user?.name).toBe("Charlie");
    expect(user?.addresses).toHaveLength(1);
  });

  it("returns null for unknown id", async () => {
    const user = await getUserWithAddresses("00000000-0000-0000-0000-000000000000");
    expect(user).toBeNull();
  });
});

describe("findUserByName", () => {
  it("finds user by exact name (case-insensitive)", async () => {
    await createTestUser({ name: "Diana" });
    const user = await findUserByName("diana");
    expect(user).not.toBeNull();
    expect(user?.name).toBe("Diana");
  });

  it("returns null when name does not match", async () => {
    const user = await findUserByName("Nonexistent");
    expect(user).toBeNull();
  });
});

describe("getAllUsers", () => {
  it("returns all users with addresses", async () => {
    await createTestUser({ name: "User1", addresses: [{ channel: "sms", address: "+15550000001" }] });
    await createTestUser({ name: "User2", addresses: [{ channel: "sms", address: "+15550000002" }] });
    const users = await getAllUsers();
    expect(users.length).toBeGreaterThanOrEqual(2);
    users.forEach((u) => {
      expect(u.addresses).toBeDefined();
    });
  });
});
