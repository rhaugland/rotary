// tests/e2e/workspace-flow.test.ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser } from "../helpers/setup.js";
import { createWorkspace, addMember } from "../../src/db/workspaces.js";
import { createInviteLink, validateInvite, consumeInvite } from "../../src/db/invites.js";
import { createMagicLink, validateAndConsumeMagicLink } from "../../src/db/magic-links.js";
import { signToken, verifyToken } from "../../src/auth/jwt.js";
import { createTask } from "../../src/db/tasks.js";

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe("Full workspace lifecycle", () => {
  it("admin creates workspace → generates invite → user joins → auth → task created in workspace", async () => {
    // 1. Admin exists
    const admin = await createTestUser({
      name: "Ryan",
      role: "admin",
      preferredChannel: "email",
      addresses: [{ channel: "email", address: "ryan@test.com" }],
    });

    // 2. Admin creates workspace
    const workspace = await createWorkspace({ name: "W3 Digital", creatorId: admin.id });
    expect(workspace.slug).toBe("w3-digital");
    expect(workspace.members).toHaveLength(1);

    // 3. Admin creates invite link
    const invite = await createInviteLink({ workspaceId: workspace.id, createdById: admin.id });
    expect(invite.token).toBeTruthy();

    // 4. New user validates and joins via invite
    const validation = await validateInvite(invite.token);
    expect(validation.valid).toBe(true);
    expect(validation.workspaceName).toBe("W3 Digital");

    const jake = await createTestUser({
      name: "Jake",
      preferredChannel: "sms",
      addresses: [{ channel: "sms", address: "+15550070001" }],
    });
    await addMember(workspace.id, jake.id, "member");
    await consumeInvite(invite.token);

    // 5. Jake authenticates via magic link
    const magicLink = await createMagicLink(jake.id);
    const authUser = await validateAndConsumeMagicLink(magicLink.token);
    expect(authUser).not.toBeNull();
    expect(authUser!.id).toBe(jake.id);

    // 6. JWT is issued
    const jwt = signToken(jake.id);
    const payload = verifyToken(jwt);
    expect(payload!.userId).toBe(jake.id);

    // 7. Task is created within workspace
    const task = await createTask({
      title: "Finish the logo",
      assigneeId: jake.id,
      creatorId: admin.id,
      workspaceId: workspace.id,
    });
    expect(task.title).toBe("Finish the logo");
    expect((task as any).workspaceId).toBe(workspace.id);

    // 8. Verify workspace-scoped queries work
    const workspaceTasks = await testPrisma.task.findMany({ where: { workspaceId: workspace.id } });
    expect(workspaceTasks).toHaveLength(1);

    const members = await testPrisma.workspaceMember.findMany({ where: { workspaceId: workspace.id } });
    expect(members).toHaveLength(2);
  });
});
