import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser, createTestWorkspace } from "../helpers/setup";
import { createMagicLink } from "../../src/db/magic-links";
import { signToken } from "../../src/auth/jwt";

vi.mock("../../src/adapters/index.js", () => ({
  getAdapter: vi.fn(() => ({
    sendMessage: vi.fn().mockResolvedValue(true),
  })),
}));

import express from "express";
import { authRouter } from "../../src/api/auth";

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

async function request(method: "get" | "post", path: string, body?: any, token?: string) {
  const { default: supertest } = await import("supertest");
  let req = supertest(app)[method](`/api/auth${path}`);
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  if (body) req = req.send(body);
  return req;
}

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe("POST /api/auth/request", () => {
  it("returns sent: true for a known address", async () => {
    await createTestUser({ name: "Alice", addresses: [{ channel: "sms", address: "+15550040001" }] });
    const res = await request("post", "/request", { address: "+15550040001" });
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(true);
  });

  it("returns sent: true even for unknown address (no user enumeration)", async () => {
    const res = await request("post", "/request", { address: "+19999999999" });
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(true);
  });
});

describe("POST /api/auth/verify", () => {
  it("returns JWT for valid magic link token", async () => {
    const user = await createTestUser({ name: "Alice", addresses: [{ channel: "sms", address: "+15550040002" }] });
    const link = await createMagicLink(user.id);
    const res = await request("post", "/verify", { token: link.token });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.name).toBe("Alice");
  });

  it("returns 401 for invalid token", async () => {
    const res = await request("post", "/verify", { token: "bad-token" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns user info with workspaces", async () => {
    const user = await createTestUser({ name: "Alice", addresses: [{ channel: "sms", address: "+15550040003" }] });
    await createTestWorkspace({ name: "WS1", slug: "ws1", adminUserId: user.id });
    const token = signToken(user.id);
    const res = await request("get", "/me", undefined, token);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Alice");
    expect(res.body.workspaces).toHaveLength(1);
    expect(res.body.workspaces[0].name).toBe("WS1");
  });

  it("returns 401 without token", async () => {
    const res = await request("get", "/me");
    expect(res.status).toBe(401);
  });
});
