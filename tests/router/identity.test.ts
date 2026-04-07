import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser } from "../helpers/setup.js";
import { resolveIdentity } from "../../src/router/identity.js";

describe("resolveIdentity", () => {
  beforeEach(async () => { await cleanDatabase(); });
  afterAll(async () => { await cleanDatabase(); await testPrisma.$disconnect(); });

  it("resolves a known phone number to a user", async () => {
    const user = await createTestUser({ name: "Jake", addresses: [{ channel: "sms", address: "+15559876543" }] });
    const result = await resolveIdentity("+15559876543");
    expect(result).not.toBeNull();
    expect(result!.id).toBe(user.id);
  });

  it("returns null for unknown address", async () => {
    const result = await resolveIdentity("nobody@nowhere.com");
    expect(result).toBeNull();
  });
});
