import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser, createTestWorkspace } from "../helpers/setup";
import {
  createWorkspace,
  getWorkspaceBySlug,
  getWorkspacesForUser,
  addMember,
  removeMember,
  getMembersOfWorkspace,
  getUserRoleInWorkspace,
} from "../../src/db/workspaces";

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe("createWorkspace", () => {
  it("creates a workspace and adds the creator as admin", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550010001" }] });
    const ws = await createWorkspace({ name: "My Project", creatorId: user.id });
    expect(ws.name).toBe("My Project");
    expect(ws.slug).toBe("my-project");
    expect(ws.members).toHaveLength(1);
    expect(ws.members[0].userId).toBe(user.id);
    expect(ws.members[0].role).toBe("admin");
  });

  it("generates unique slugs for duplicate names", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550010002" }] });
    const ws1 = await createWorkspace({ name: "My Project", creatorId: user.id });
    const ws2 = await createWorkspace({ name: "My Project", creatorId: user.id });
    expect(ws1.slug).toBe("my-project");
    expect(ws2.slug).not.toBe(ws1.slug);
    expect(ws2.slug).toMatch(/^my-project-/);
  });
});

describe("getWorkspaceBySlug", () => {
  it("returns workspace by slug", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550010003" }] });
    await createWorkspace({ name: "Test WS", creatorId: user.id });
    const ws = await getWorkspaceBySlug("test-ws");
    expect(ws).not.toBeNull();
    expect(ws?.name).toBe("Test WS");
  });

  it("returns null for unknown slug", async () => {
    const ws = await getWorkspaceBySlug("nonexistent");
    expect(ws).toBeNull();
  });
});

describe("getWorkspacesForUser", () => {
  it("returns all workspaces a user belongs to", async () => {
    const user = await createTestUser({ name: "Multi", addresses: [{ channel: "sms", address: "+15550010004" }] });
    await createWorkspace({ name: "WS1", creatorId: user.id });
    await createWorkspace({ name: "WS2", creatorId: user.id });
    const workspaces = await getWorkspacesForUser(user.id);
    expect(workspaces).toHaveLength(2);
  });
});

describe("addMember", () => {
  it("adds a user to a workspace as member", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550010005" }] });
    const member = await createTestUser({ name: "Member", addresses: [{ channel: "sms", address: "+15550010006" }] });
    const ws = await createWorkspace({ name: "Team", creatorId: admin.id });
    const membership = await addMember(ws.id, member.id, "member");
    expect(membership.userId).toBe(member.id);
    expect(membership.role).toBe("member");
  });

  it("does not duplicate membership", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550010007" }] });
    const ws = await createWorkspace({ name: "Team", creatorId: admin.id });
    const membership = await addMember(ws.id, admin.id, "admin");
    expect(membership.userId).toBe(admin.id);
    const members = await getMembersOfWorkspace(ws.id);
    expect(members).toHaveLength(1);
  });
});

describe("removeMember", () => {
  it("removes a user from a workspace", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550010008" }] });
    const member = await createTestUser({ name: "Member", addresses: [{ channel: "sms", address: "+15550010009" }] });
    const ws = await createWorkspace({ name: "Team", creatorId: admin.id });
    await addMember(ws.id, member.id, "member");
    await removeMember(ws.id, member.id);
    const members = await getMembersOfWorkspace(ws.id);
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(admin.id);
  });
});

describe("getUserRoleInWorkspace", () => {
  it("returns the user role in a workspace", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550010010" }] });
    const ws = await createWorkspace({ name: "Team", creatorId: admin.id });
    const role = await getUserRoleInWorkspace(ws.id, admin.id);
    expect(role).toBe("admin");
  });

  it("returns null if user is not a member", async () => {
    const admin = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550010011" }] });
    const other = await createTestUser({ name: "Other", addresses: [{ channel: "sms", address: "+15550010012" }] });
    const ws = await createWorkspace({ name: "Team", creatorId: admin.id });
    const role = await getUserRoleInWorkspace(ws.id, other.id);
    expect(role).toBeNull();
  });
});
