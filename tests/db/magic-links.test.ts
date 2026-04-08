import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser } from "../helpers/setup";
import {
  createMagicLink,
  validateAndConsumeMagicLink,
} from "../../src/db/magic-links";

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe("createMagicLink", () => {
  it("creates a magic link with 15-minute expiry", async () => {
    const user = await createTestUser({ name: "Login User", addresses: [{ channel: "sms", address: "+15550030001" }] });
    const link = await createMagicLink(user.id);
    expect(link.token).toBeTruthy();
    expect(link.token.length).toBeGreaterThan(20);
    expect(link.used).toBe(false);
    const diffMs = link.expiresAt.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(14 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
  });
});

describe("validateAndConsumeMagicLink", () => {
  it("returns user for a valid token and marks it used", async () => {
    const user = await createTestUser({ name: "Login User", addresses: [{ channel: "sms", address: "+15550030002" }] });
    const link = await createMagicLink(user.id);
    const result = await validateAndConsumeMagicLink(link.token);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(user.id);
    const dbLink = await testPrisma.magicLink.findUnique({ where: { id: link.id } });
    expect(dbLink!.used).toBe(true);
  });

  it("returns null for unknown token", async () => {
    const result = await validateAndConsumeMagicLink("fake-token");
    expect(result).toBeNull();
  });

  it("returns null for already-used token", async () => {
    const user = await createTestUser({ name: "Login User", addresses: [{ channel: "sms", address: "+15550030003" }] });
    const link = await createMagicLink(user.id);
    await validateAndConsumeMagicLink(link.token);
    const result = await validateAndConsumeMagicLink(link.token);
    expect(result).toBeNull();
  });

  it("returns null for expired token", async () => {
    const user = await createTestUser({ name: "Login User", addresses: [{ channel: "sms", address: "+15550030004" }] });
    const link = await testPrisma.magicLink.create({
      data: {
        userId: user.id,
        token: "expired-token-test",
        expiresAt: new Date(Date.now() - 1000),
        used: false,
      },
    });
    const result = await validateAndConsumeMagicLink(link.token);
    expect(result).toBeNull();
  });
});
