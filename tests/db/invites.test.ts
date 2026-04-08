import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser, createTestWorkspace } from "../helpers/setup";
import {
  createInviteLink,
  getInviteByToken,
  validateInvite,
  consumeInvite,
  getActiveInvites,
  deactivateInvite,
} from "../../src/db/invites";

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe("createInviteLink", () => {
  it("creates an invite link with a unique token", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550020001" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team", adminUserId: user.id });
    const invite = await createInviteLink({ workspaceId: ws.id, createdById: user.id });
    expect(invite.token).toBeTruthy();
    expect(invite.token.length).toBeGreaterThan(20);
    expect(invite.active).toBe(true);
    expect(invite.useCount).toBe(0);
  });

  it("creates an invite with expiry and max uses", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550020002" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team2", adminUserId: user.id });
    const expiresAt = new Date(Date.now() + 86400000);
    const invite = await createInviteLink({ workspaceId: ws.id, createdById: user.id, expiresAt, maxUses: 5 });
    expect(invite.maxUses).toBe(5);
    expect(invite.expiresAt).not.toBeNull();
  });
});

describe("validateInvite", () => {
  it("returns valid for a good invite", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550020003" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team3", adminUserId: user.id });
    const invite = await createInviteLink({ workspaceId: ws.id, createdById: user.id });
    const result = await validateInvite(invite.token);
    expect(result.valid).toBe(true);
    expect(result.workspaceName).toBe("Team");
  });

  it("returns invalid for unknown token", async () => {
    const result = await validateInvite("nonexistent-token");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invite not found");
  });

  it("returns invalid for expired invite", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550020004" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team4", adminUserId: user.id });
    const invite = await createInviteLink({ workspaceId: ws.id, createdById: user.id, expiresAt: new Date(Date.now() - 1000) });
    const result = await validateInvite(invite.token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invite has expired");
  });

  it("returns invalid for deactivated invite", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550020005" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team5", adminUserId: user.id });
    const invite = await createInviteLink({ workspaceId: ws.id, createdById: user.id });
    await deactivateInvite(invite.id);
    const result = await validateInvite(invite.token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invite is no longer active");
  });

  it("returns invalid when max uses reached", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550020006" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team6", adminUserId: user.id });
    const invite = await createInviteLink({ workspaceId: ws.id, createdById: user.id, maxUses: 1 });
    await consumeInvite(invite.token);
    const result = await validateInvite(invite.token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invite has reached max uses");
  });
});

describe("consumeInvite", () => {
  it("increments useCount", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550020007" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team7", adminUserId: user.id });
    const invite = await createInviteLink({ workspaceId: ws.id, createdById: user.id });
    const updated = await consumeInvite(invite.token);
    expect(updated.useCount).toBe(1);
  });
});

describe("getActiveInvites", () => {
  it("returns only active invites for a workspace", async () => {
    const user = await createTestUser({ name: "Admin", addresses: [{ channel: "sms", address: "+15550020008" }] });
    const ws = await createTestWorkspace({ name: "Team", slug: "team8", adminUserId: user.id });
    await createInviteLink({ workspaceId: ws.id, createdById: user.id });
    const invite2 = await createInviteLink({ workspaceId: ws.id, createdById: user.id });
    await deactivateInvite(invite2.id);
    const active = await getActiveInvites(ws.id);
    expect(active).toHaveLength(1);
  });
});
