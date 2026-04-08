import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser, createTestWorkspace } from "../helpers/setup";
import { signToken } from "../../src/auth/jwt";

vi.mock("../../src/adapters/index.js", () => ({
  getAdapter: vi.fn(() => ({
    sendMessage: vi.fn().mockResolvedValue(true),
  })),
}));

import express from "express";
import { invitesRouter } from "../../src/api/invites";

const app = express();
app.use(express.json());
app.use("/api", invitesRouter);

async function request(method: "get" | "post" | "delete", path: string, body?: any, token?: string) {
  const { default: supertest } = await import("supertest");
  let req = supertest(app)[method](`/api${path}`);
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

describe("POST /api/workspaces/:id/invites", () => {
  it("creates an invite link (admin only)", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550060001" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team-inv", adminUserId: admin.id });
    const token = signToken(admin.id);
    const res = await request("post", `/workspaces/${ws.id}/invites`, {}, token);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.url).toContain(res.body.token);
  });

  it("returns 403 for non-admin member", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550060002" }] });
    const member = await createTestUser({ name: "Member", addresses: [{ channel: "sms", address: "+15550060003" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team-inv2", adminUserId: admin.id });
    await testPrisma.workspaceMember.create({ data: { workspaceId: ws.id, userId: member.id, role: "member" } });
    const token = signToken(member.id);
    const res = await request("post", `/workspaces/${ws.id}/invites`, {}, token);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/workspaces/:id/invites", () => {
  it("lists active invites for admin", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550060004" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team-inv3", adminUserId: admin.id });
    const token = signToken(admin.id);
    await request("post", `/workspaces/${ws.id}/invites`, {}, token);
    const res = await request("get", `/workspaces/${ws.id}/invites`, undefined, token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("DELETE /api/workspaces/:id/invites/:inviteId", () => {
  it("deactivates an invite", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550060005" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team-inv4", adminUserId: admin.id });
    const token = signToken(admin.id);
    const createRes = await request("post", `/workspaces/${ws.id}/invites`, {}, token);
    const inviteId = createRes.body.id;
    const res = await request("delete", `/workspaces/${ws.id}/invites/${inviteId}`, undefined, token);
    expect(res.status).toBe(200);
    const listRes = await request("get", `/workspaces/${ws.id}/invites`, undefined, token);
    expect(listRes.body).toHaveLength(0);
  });
});

describe("GET /api/invite/:token", () => {
  it("validates a good invite and returns workspace name", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550060006" }] });
    const ws = await createTestWorkspace({ name: "Cool Team", slug: "cool-team", adminUserId: admin.id });
    const token = signToken(admin.id);
    const createRes = await request("post", `/workspaces/${ws.id}/invites`, {}, token);
    const res = await request("get", `/invite/${createRes.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.workspaceName).toBe("Cool Team");
  });

  it("returns invalid for bad token", async () => {
    const res = await request("get", "/invite/nonexistent");
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });
});

describe("POST /api/invite/:token/join", () => {
  it("creates user and adds to workspace", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550060007" }] });
    const ws = await createTestWorkspace({ name: "Join Team", slug: "join-team", adminUserId: admin.id });
    const adminToken = signToken(admin.id);
    const createRes = await request("post", `/workspaces/${ws.id}/invites`, {}, adminToken);
    const res = await request("post", `/invite/${createRes.body.token}/join`, {
      name: "New User",
      preferredChannel: "sms",
      address: "+15550060008",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe("New User");
    expect(res.body.workspace.name).toBe("Join Team");
  });

  it("adds existing user to workspace without duplicating", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550060009" }] });
    const existing = await createTestUser({ name: "Existing", addresses: [{ channel: "sms", address: "+15550060010" }] });
    const ws = await createTestWorkspace({ name: "Existing Team", slug: "existing-team", adminUserId: admin.id });
    const adminToken = signToken(admin.id);
    const createRes = await request("post", `/workspaces/${ws.id}/invites`, {}, adminToken);
    const res = await request("post", `/invite/${createRes.body.token}/join`, {
      name: "Existing",
      preferredChannel: "sms",
      address: "+15550060010",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.id).toBe(existing.id);
  });

  it("returns 400 for invalid invite", async () => {
    const res = await request("post", "/invite/bad-token/join", {
      name: "Test",
      preferredChannel: "sms",
      address: "+15550060011",
    });
    expect(res.status).toBe(400);
  });
});
