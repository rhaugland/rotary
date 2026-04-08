import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser, createTestWorkspace } from "../helpers/setup";
import { signToken } from "../../src/auth/jwt";

vi.mock("../../src/adapters/index.js", () => ({
  getAdapter: vi.fn(() => ({
    sendMessage: vi.fn().mockResolvedValue(true),
  })),
}));

import express from "express";
import { workspacesRouter } from "../../src/api/workspaces";

const app = express();
app.use(express.json());
app.use("/api/workspaces", workspacesRouter);

async function request(method: "get" | "post" | "delete", path: string, body?: any, token?: string) {
  const { default: supertest } = await import("supertest");
  let req = supertest(app)[method](`/api/workspaces${path}`);
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

describe("POST /api/workspaces", () => {
  it("creates a workspace and adds creator as admin", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550050001" }] });
    const token = signToken(user.id);
    const res = await request("post", "", { name: "My Project" }, token);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("My Project");
    expect(res.body.slug).toBe("my-project");
  });

  it("returns 401 without auth", async () => {
    const res = await request("post", "", { name: "Test" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/workspaces", () => {
  it("returns workspaces for the current user", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550050002" }] });
    await createTestWorkspace({ name: "WS1", slug: "ws1", adminUserId: user.id });
    const token = signToken(user.id);
    const res = await request("get", "", undefined, token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("WS1");
  });
});

describe("GET /api/workspaces/:id/dashboard", () => {
  it("returns dashboard stats for a workspace", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550050003" }] });
    const member = await createTestUser({ name: "Member", addresses: [{ channel: "sms", address: "+15550050004" }] });
    const ws = await createTestWorkspace({ name: "Dashboard WS", slug: "dash-ws", adminUserId: admin.id });
    await testPrisma.workspaceMember.create({ data: { workspaceId: ws.id, userId: member.id, role: "member" } });
    await testPrisma.task.create({ data: { title: "Open task", assigneeId: member.id, creatorId: admin.id, workspaceId: ws.id, status: "open" } });
    await testPrisma.task.create({ data: { title: "Done task", assigneeId: member.id, creatorId: admin.id, workspaceId: ws.id, status: "done" } });

    const token = signToken(admin.id);
    const res = await request("get", `/${ws.id}/dashboard`, undefined, token);
    expect(res.status).toBe(200);
    expect(res.body.openTasks).toBe(1);
    expect(res.body.completedTasks).toBe(1);
    expect(res.body.memberCount).toBe(2);
  });

  it("returns 403 for non-member", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550050005" }] });
    const outsider = await createTestUser({ name: "Outsider", addresses: [{ channel: "sms", address: "+15550050006" }] });
    const ws = await createTestWorkspace({ name: "Private WS", slug: "private-ws", adminUserId: admin.id });
    const token = signToken(outsider.id);
    const res = await request("get", `/${ws.id}/dashboard`, undefined, token);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/workspaces/:id/tasks", () => {
  it("returns tasks for the workspace", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550050007" }] });
    const ws = await createTestWorkspace({ name: "Task WS", slug: "task-ws", adminUserId: admin.id });
    await testPrisma.task.create({ data: { title: "Task 1", assigneeId: admin.id, creatorId: admin.id, workspaceId: ws.id } });
    const token = signToken(admin.id);
    const res = await request("get", `/${ws.id}/tasks`, undefined, token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Task 1");
  });
});

describe("GET /api/workspaces/:id/members", () => {
  it("returns members of the workspace", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550050008" }] });
    const ws = await createTestWorkspace({ name: "Members WS", slug: "members-ws", adminUserId: admin.id });
    const token = signToken(admin.id);
    const res = await request("get", `/${ws.id}/members`, undefined, token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Admin");
  });
});

describe("GET /api/workspaces/:id/my-tasks", () => {
  it("returns only the current user tasks", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550050009" }] });
    const member = await createTestUser({ name: "Member", addresses: [{ channel: "sms", address: "+15550050010" }] });
    const ws = await createTestWorkspace({ name: "My Tasks WS", slug: "my-tasks-ws", adminUserId: admin.id });
    await testPrisma.workspaceMember.create({ data: { workspaceId: ws.id, userId: member.id, role: "member" } });
    await testPrisma.task.create({ data: { title: "Admin task", assigneeId: admin.id, creatorId: member.id, workspaceId: ws.id } });
    await testPrisma.task.create({ data: { title: "Member task", assigneeId: member.id, creatorId: admin.id, workspaceId: ws.id } });

    const token = signToken(member.id);
    const res = await request("get", `/${ws.id}/my-tasks`, undefined, token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Member task");
  });
});

describe("GET /api/workspaces/:id/activity", () => {
  it("returns recent messages for the workspace", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550050011" }] });
    const ws = await createTestWorkspace({ name: "Activity WS", slug: "activity-ws", adminUserId: admin.id });
    const task = await testPrisma.task.create({ data: { title: "Task", assigneeId: admin.id, creatorId: admin.id, workspaceId: ws.id } });
    await testPrisma.message.create({ data: { taskId: task.id, userId: admin.id, channel: "sms", direction: "inbound", rawText: "created a task" } });

    const token = signToken(admin.id);
    const res = await request("get", `/${ws.id}/activity`, undefined, token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
