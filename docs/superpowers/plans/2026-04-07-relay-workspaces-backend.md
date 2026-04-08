# Relay Workspaces & Auth Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace scoping, magic link auth, invite-based onboarding, and workspace-scoped API endpoints to the Relay backend.

**Architecture:** Workspaces are project-scoped containers. Users join via invite links and authenticate via magic links sent to their preferred channel. Tasks are scoped to a workspace. The existing router is updated to resolve workspace context when routing inbound messages. All new API endpoints are workspace-scoped with JWT auth.

**Tech Stack:** Prisma 7 (PostgreSQL), Express 5, jsonwebtoken, crypto (Node built-in)

---

## File Structure

**New files:**
- `src/db/workspaces.ts` — Workspace CRUD, membership management
- `src/db/invites.ts` — Invite link CRUD
- `src/db/magic-links.ts` — Magic link CRUD
- `src/auth/jwt.ts` — JWT sign/verify helpers
- `src/auth/middleware.ts` — Express auth middleware (requireAuth, requireWorkspaceMember, requireWorkspaceAdmin)
- `src/api/auth.ts` — Auth routes (request magic link, verify, me)
- `src/api/workspaces.ts` — Workspace routes (CRUD, dashboard, tasks, members, activity)
- `src/api/invites.ts` — Invite/onboarding routes (public)
- `tests/db/workspaces.test.ts` — Workspace DB tests
- `tests/db/invites.test.ts` — Invite DB tests
- `tests/db/magic-links.test.ts` — Magic link DB tests
- `tests/auth/jwt.test.ts` — JWT tests
- `tests/auth/middleware.test.ts` — Auth middleware tests
- `tests/api/auth.test.ts` — Auth route tests
- `tests/api/workspaces.test.ts` — Workspace route tests
- `tests/api/invites.test.ts` — Invite route tests

**Modified files:**
- `prisma/schema.prisma` — Add Workspace, WorkspaceMember, InviteLink, MagicLink models; add workspaceId to Task
- `src/db/tasks.ts` — Add workspaceId param to createTask, add workspace-scoped query functions
- `src/db/users.ts` — Add findUserByNameInWorkspace
- `src/router/router.ts` — Add workspace resolution to handleInboundMessage, handleCreateTask
- `src/scheduler/workers.ts` — Include workspace name in notification messages
- `src/server.ts` — Mount new API routers
- `src/config.ts` — Add JWT_SECRET env var
- `tests/helpers/setup.ts` — Update TRUNCATE to include new tables, add createTestWorkspace helper
- `package.json` — Add jsonwebtoken dependency

---

### Task 1: Schema Migration — Workspace, WorkspaceMember, InviteLink, MagicLink

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `tests/helpers/setup.ts`

- [ ] **Step 1: Add new models and enum to Prisma schema**

Add the following to `prisma/schema.prisma` after the existing enums:

```prisma
enum WorkspaceRole {
  admin
  member
}
```

Add after the existing models:

```prisma
model Workspace {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members    WorkspaceMember[]
  tasks      Task[]
  inviteLinks InviteLink[]

  @@map("workspaces")
}

model WorkspaceMember {
  id          String        @id @default(uuid())
  workspaceId String
  userId      String
  role        WorkspaceRole @default(member)
  joinedAt    DateTime      @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
  @@map("workspace_members")
}

model InviteLink {
  id          String    @id @default(uuid())
  workspaceId String
  token       String    @unique
  createdById String
  expiresAt   DateTime?
  maxUses     Int?
  useCount    Int       @default(0)
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdBy User      @relation("inviteCreator", fields: [createdById], references: [id])

  @@map("invite_links")
}

model MagicLink {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("magic_links")
}
```

Add `workspaceId` to the existing `Task` model. Add this field after `creatorId`:

```prisma
  workspaceId String?
```

And add this relation after the `creator` relation:

```prisma
  workspace Workspace? @relation(fields: [workspaceId], references: [id])
```

Note: `workspaceId` is nullable for backward compatibility with existing tasks. New tasks will always have it set.

Add these relations to the existing `User` model (after the `messages` relation):

```prisma
  memberships    WorkspaceMember[]
  magicLinks     MagicLink[]
  createdInvites InviteLink[]   @relation("inviteCreator")
```

- [ ] **Step 2: Run the migration**

Run: `cd /Users/ryanhaugland/relay && npx prisma migrate dev --name add-workspaces`
Expected: Migration succeeds, Prisma client regenerated

- [ ] **Step 3: Update test helper TRUNCATE and add workspace helper**

In `tests/helpers/setup.ts`, update the TRUNCATE statement to include new tables:

```typescript
import "dotenv/config";
import { Channel, Role, WorkspaceRole } from "@prisma/client";
import { getPrisma } from "../../src/db/client.js";

export const testPrisma = getPrisma();

export async function cleanDatabase() {
  await testPrisma.$executeRawUnsafe('TRUNCATE TABLE magic_links, invite_links, workspace_members, messages, tasks, user_addresses, workspaces, users CASCADE');
}

export async function createTestUser(overrides: {
  name?: string;
  role?: Role;
  preferredChannel?: Channel;
  addresses?: { channel: Channel; address: string }[];
} = {}) {
  const user = await testPrisma.user.create({
    data: {
      name: overrides.name ?? "Test User",
      role: overrides.role ?? "member",
      preferredChannel: overrides.preferredChannel ?? "sms",
      addresses: {
        create: overrides.addresses ?? [
          { channel: "sms", address: "+15551234567" },
        ],
      },
    },
    include: { addresses: true },
  });
  return user;
}

export async function createTestWorkspace(overrides: {
  name?: string;
  slug?: string;
  adminUserId?: string;
} = {}) {
  const workspace = await testPrisma.workspace.create({
    data: {
      name: overrides.name ?? "Test Workspace",
      slug: overrides.slug ?? "test-workspace",
      members: overrides.adminUserId
        ? { create: { userId: overrides.adminUserId, role: "admin" } }
        : undefined,
    },
    include: { members: true },
  });
  return workspace;
}
```

- [ ] **Step 4: Run existing tests to ensure nothing broke**

Run: `cd /Users/ryanhaugland/relay && npx vitest run`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ tests/helpers/setup.ts
git commit -m "feat: add workspace, membership, invite, and magic link schema"
```

---

### Task 2: Workspace Database Layer

**Files:**
- Create: `src/db/workspaces.ts`
- Test: `tests/db/workspaces.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/db/workspaces.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/db/workspaces.test.ts`
Expected: FAIL — module `../../src/db/workspaces` not found

- [ ] **Step 3: Write the implementation**

Create `src/db/workspaces.ts`:

```typescript
import { WorkspaceRole } from "@prisma/client";
import { getPrisma } from "./client.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createWorkspace(data: { name: string; creatorId: string }) {
  const prisma = getPrisma();
  let slug = slugify(data.name);

  const existing = await prisma.workspace.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  return prisma.workspace.create({
    data: {
      name: data.name,
      slug,
      members: {
        create: { userId: data.creatorId, role: "admin" },
      },
    },
    include: { members: true },
  });
}

export async function getWorkspaceBySlug(slug: string) {
  const prisma = getPrisma();
  return prisma.workspace.findUnique({
    where: { slug },
    include: { members: { include: { user: true } } },
  });
}

export async function getWorkspaceById(id: string) {
  const prisma = getPrisma();
  return prisma.workspace.findUnique({
    where: { id },
    include: { members: { include: { user: true } } },
  });
}

export async function getWorkspacesForUser(userId: string) {
  const prisma = getPrisma();
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role }));
}

export async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
  const prisma = getPrisma();
  return prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    update: { role },
    create: { workspaceId, userId, role },
  });
}

export async function removeMember(workspaceId: string, userId: string) {
  const prisma = getPrisma();
  return prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export async function getMembersOfWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { include: { addresses: true } } },
  });
}

export async function getUserRoleInWorkspace(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
  const prisma = getPrisma();
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  return member?.role ?? null;
}

export async function findUserByNameInWorkspace(workspaceId: string, name: string) {
  const prisma = getPrisma();
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { include: { addresses: true } } },
  });
  return members.find((m) => m.user.name.toLowerCase() === name.toLowerCase())?.user ?? null;
}

export async function getWorkspaceMemberships(userId: string) {
  const prisma = getPrisma();
  return prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/db/workspaces.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/workspaces.ts tests/db/workspaces.test.ts
git commit -m "feat: add workspace database layer with membership management"
```

---

### Task 3: Invite Link Database Layer

**Files:**
- Create: `src/db/invites.ts`
- Test: `tests/db/invites.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/db/invites.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/db/invites.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/db/invites.ts`:

```typescript
import crypto from "crypto";
import { getPrisma } from "./client.js";

export async function createInviteLink(data: {
  workspaceId: string;
  createdById: string;
  expiresAt?: Date;
  maxUses?: number;
}) {
  const prisma = getPrisma();
  const token = crypto.randomBytes(32).toString("url-safe-base64");
  return prisma.inviteLink.create({
    data: {
      workspaceId: data.workspaceId,
      token,
      createdById: data.createdById,
      expiresAt: data.expiresAt,
      maxUses: data.maxUses,
    },
  });
}

export async function getInviteByToken(token: string) {
  const prisma = getPrisma();
  return prisma.inviteLink.findUnique({
    where: { token },
    include: { workspace: true },
  });
}

export async function validateInvite(token: string): Promise<{ valid: boolean; workspaceName?: string; workspaceId?: string; reason?: string }> {
  const invite = await getInviteByToken(token);
  if (!invite) return { valid: false, reason: "Invite not found" };
  if (!invite.active) return { valid: false, reason: "Invite is no longer active" };
  if (invite.expiresAt && invite.expiresAt < new Date()) return { valid: false, reason: "Invite has expired" };
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return { valid: false, reason: "Invite has reached max uses" };
  return { valid: true, workspaceName: invite.workspace.name, workspaceId: invite.workspace.id };
}

export async function consumeInvite(token: string) {
  const prisma = getPrisma();
  return prisma.inviteLink.update({
    where: { token },
    data: { useCount: { increment: 1 } },
  });
}

export async function getActiveInvites(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.inviteLink.findMany({
    where: { workspaceId, active: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function deactivateInvite(inviteId: string) {
  const prisma = getPrisma();
  return prisma.inviteLink.update({
    where: { id: inviteId },
    data: { active: false },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/db/invites.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/invites.ts tests/db/invites.test.ts
git commit -m "feat: add invite link database layer with validation"
```

---

### Task 4: Magic Link Database Layer

**Files:**
- Create: `src/db/magic-links.ts`
- Test: `tests/db/magic-links.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/db/magic-links.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/db/magic-links.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/db/magic-links.ts`:

```typescript
import crypto from "crypto";
import { getPrisma } from "./client.js";

const MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export async function createMagicLink(userId: string) {
  const prisma = getPrisma();
  const token = crypto.randomBytes(32).toString("url-safe-base64");
  return prisma.magicLink.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + MAGIC_LINK_EXPIRY_MS),
    },
  });
}

export async function validateAndConsumeMagicLink(token: string) {
  const prisma = getPrisma();
  const link = await prisma.magicLink.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!link) return null;
  if (link.used) return null;
  if (link.expiresAt < new Date()) return null;

  await prisma.magicLink.update({
    where: { id: link.id },
    data: { used: true },
  });

  return link.user;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/db/magic-links.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/magic-links.ts tests/db/magic-links.test.ts
git commit -m "feat: add magic link database layer with validation"
```

---

### Task 5: JWT Auth Helpers

**Files:**
- Create: `src/auth/jwt.ts`
- Modify: `src/config.ts`
- Modify: `package.json` (install jsonwebtoken)
- Test: `tests/auth/jwt.test.ts`

- [ ] **Step 1: Install jsonwebtoken**

Run: `cd /Users/ryanhaugland/relay && npm install jsonwebtoken && npm install --save-dev @types/jsonwebtoken`

- [ ] **Step 2: Add JWT_SECRET to config**

In `src/config.ts`, add to the config object after the `anthropic` section:

```typescript
  jwt: {
    secret: optionalEnv("JWT_SECRET", "dev-secret-change-in-production"),
  },
```

- [ ] **Step 3: Add JWT_SECRET to .env**

Add to the bottom of `.env`:

```
JWT_SECRET=relay-dev-secret-key-change-me
```

- [ ] **Step 4: Write the failing tests**

Create `tests/auth/jwt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../../src/auth/jwt";

describe("signToken", () => {
  it("returns a JWT string", () => {
    const token = signToken("user-123");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });
});

describe("verifyToken", () => {
  it("returns userId for a valid token", () => {
    const token = signToken("user-456");
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe("user-456");
  });

  it("returns null for an invalid token", () => {
    const payload = verifyToken("garbage.token.here");
    expect(payload).toBeNull();
  });

  it("returns null for a tampered token", () => {
    const token = signToken("user-789");
    const tampered = token.slice(0, -5) + "xxxxx";
    const payload = verifyToken(tampered);
    expect(payload).toBeNull();
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/auth/jwt.test.ts`
Expected: FAIL — module not found

- [ ] **Step 6: Write the implementation**

Create `src/auth/jwt.ts`:

```typescript
import jwt from "jsonwebtoken";
import { config } from "../config.js";

interface JwtPayload {
  userId: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn: "24h" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/auth/jwt.test.ts`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/auth/jwt.ts src/config.ts tests/auth/jwt.test.ts package.json package-lock.json
git commit -m "feat: add JWT auth helpers for token signing and verification"
```

---

### Task 6: Auth Middleware

**Files:**
- Create: `src/auth/middleware.ts`
- Test: `tests/auth/middleware.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/auth/middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, requireWorkspaceMember, requireWorkspaceAdmin } from "../../src/auth/middleware";
import { signToken } from "../../src/auth/jwt";

function mockReqResNext(overrides: { headers?: Record<string, string>; params?: Record<string, string> } = {}) {
  const req = {
    headers: overrides.headers ?? {},
    params: overrides.params ?? {},
  } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe("requireAuth", () => {
  it("calls next and sets req.userId for valid token", () => {
    const token = signToken("user-123");
    const { req, res, next } = mockReqResNext({ headers: { authorization: `Bearer ${token}` } });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe("user-123");
  });

  it("returns 401 when no authorization header", () => {
    const { req, res, next } = mockReqResNext();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid token", () => {
    const { req, res, next } = mockReqResNext({ headers: { authorization: "Bearer bad-token" } });
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

vi.mock("../../src/db/workspaces.js", () => ({
  getUserRoleInWorkspace: vi.fn(),
}));

import { getUserRoleInWorkspace } from "../../src/db/workspaces";

describe("requireWorkspaceMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls next when user is a member", async () => {
    (getUserRoleInWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue("member");
    const token = signToken("user-123");
    const { req, res, next } = mockReqResNext({ headers: { authorization: `Bearer ${token}` }, params: { id: "ws-1" } });
    const middleware = requireWorkspaceMember();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.workspaceId).toBe("ws-1");
    expect(req.workspaceRole).toBe("member");
  });

  it("returns 403 when user is not a member", async () => {
    (getUserRoleInWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const token = signToken("user-123");
    const { req, res, next } = mockReqResNext({ headers: { authorization: `Bearer ${token}` }, params: { id: "ws-1" } });
    const middleware = requireWorkspaceMember();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireWorkspaceAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls next when user is an admin", async () => {
    (getUserRoleInWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue("admin");
    const token = signToken("user-123");
    const { req, res, next } = mockReqResNext({ headers: { authorization: `Bearer ${token}` }, params: { id: "ws-1" } });
    const middleware = requireWorkspaceAdmin();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when user is a member but not admin", async () => {
    (getUserRoleInWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue("member");
    const token = signToken("user-123");
    const { req, res, next } = mockReqResNext({ headers: { authorization: `Bearer ${token}` }, params: { id: "ws-1" } });
    const middleware = requireWorkspaceAdmin();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/auth/middleware.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/auth/middleware.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwt.js";
import { getUserRoleInWorkspace } from "../db/workspaces.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      workspaceId?: string;
      workspaceRole?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.userId = payload.userId;
  next();
}

export function requireWorkspaceMember() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    requireAuth(req, res, async () => {
      const workspaceId = req.params.id;
      const role = await getUserRoleInWorkspace(workspaceId, req.userId!);
      if (!role) {
        res.status(403).json({ error: "Not a member of this workspace" });
        return;
      }
      req.workspaceId = workspaceId;
      req.workspaceRole = role;
      next();
    });
  };
}

export function requireWorkspaceAdmin() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    requireAuth(req, res, async () => {
      const workspaceId = req.params.id;
      const role = await getUserRoleInWorkspace(workspaceId, req.userId!);
      if (role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      req.workspaceId = workspaceId;
      req.workspaceRole = role;
      next();
    });
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/auth/middleware.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/auth/middleware.ts tests/auth/middleware.test.ts
git commit -m "feat: add auth middleware for JWT, workspace member, and admin checks"
```

---

### Task 7: Auth API Routes

**Files:**
- Create: `src/api/auth.ts`
- Test: `tests/api/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/auth.test.ts`:

```typescript
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
```

- [ ] **Step 2: Install supertest**

Run: `cd /Users/ryanhaugland/relay && npm install --save-dev supertest @types/supertest`

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/api/auth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the implementation**

Create `src/api/auth.ts`:

```typescript
import { Router } from "express";
import { findUserByAddress, getUserWithAddresses } from "../db/users.js";
import { createMagicLink, validateAndConsumeMagicLink } from "../db/magic-links.js";
import { getWorkspacesForUser } from "../db/workspaces.js";
import { getAdapter } from "../adapters/index.js";
import { signToken } from "./jwt.js";
import { requireAuth } from "./middleware.js";

// Note: import paths use ../auth/ not ./
// This file is in src/api/, jwt and middleware are in src/auth/
// We re-export from the correct paths

export const authRouter = Router();

authRouter.post("/request", async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      res.status(400).json({ error: "address is required" });
      return;
    }

    const user = await findUserByAddress(address);
    if (user) {
      const link = await createMagicLink(user.id);
      const loginUrl = `${req.protocol}://${req.get("host")}/dashboard/verify/${link.token}`;
      const preferredAddress = user.addresses.find((a) => a.channel === user.preferredChannel);
      if (preferredAddress) {
        try {
          const adapter = getAdapter(user.preferredChannel);
          await adapter.sendMessage(preferredAddress.address, `Your Relay login link: ${loginUrl}`);
        } catch (error) {
          console.error("Failed to send magic link:", error);
        }
      }
    }

    // Always return sent: true to prevent user enumeration
    res.json({ sent: true });
  } catch (error) {
    console.error("Auth request error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

authRouter.post("/verify", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    const user = await validateAndConsumeMagicLink(token);
    if (!user) {
      res.status(401).json({ error: "Invalid or expired login link" });
      return;
    }

    const jwt = signToken(user.id);
    res.json({ token: jwt, user: { id: user.id, name: user.name } });
  } catch (error) {
    console.error("Auth verify error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await getUserWithAddresses(req.userId!);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const workspaces = await getWorkspacesForUser(req.userId!);
    res.json({
      id: user.id,
      name: user.name,
      preferredChannel: user.preferredChannel,
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        role: w.role,
      })),
    });
  } catch (error) {
    console.error("Auth me error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});
```

Note: the import for `signToken` and `requireAuth` needs to come from `../auth/` not `./`:

Fix the imports at the top:

```typescript
import { signToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/api/auth.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/auth.ts tests/api/auth.test.ts package.json package-lock.json
git commit -m "feat: add auth API routes with magic link flow"
```

---

### Task 8: Workspace API Routes

**Files:**
- Create: `src/api/workspaces.ts`
- Test: `tests/api/workspaces.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/workspaces.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/api/workspaces.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/api/workspaces.ts`:

```typescript
import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { requireWorkspaceMember, requireWorkspaceAdmin } from "../auth/middleware.js";
import {
  createWorkspace,
  getWorkspacesForUser,
  getMembersOfWorkspace,
} from "../db/workspaces.js";
import { getPrisma } from "../db/client.js";

export const workspacesRouter = Router();

// Create workspace
workspacesRouter.post("/", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const workspace = await createWorkspace({ name, creatorId: req.userId! });
    res.status(201).json({ id: workspace.id, name: workspace.name, slug: workspace.slug });
  } catch (error) {
    console.error("Create workspace error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// List user's workspaces
workspacesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const workspaces = await getWorkspacesForUser(req.userId!);
    res.json(workspaces.map((w) => ({ id: w.id, name: w.name, slug: w.slug, role: w.role })));
  } catch (error) {
    console.error("List workspaces error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Dashboard stats
workspacesRouter.get("/:id/dashboard", requireWorkspaceMember(), async (req, res) => {
  try {
    const prisma = getPrisma();
    const workspaceId = req.params.id;

    const [openTasks, overdueTasks, completedTasks, memberCount, recentTasks, recentActivity] = await Promise.all([
      prisma.task.count({ where: { workspaceId, status: { in: ["open", "in_progress"] } } }),
      prisma.task.count({ where: { workspaceId, status: "overdue" } }),
      prisma.task.count({ where: { workspaceId, status: "done" } }),
      prisma.workspaceMember.count({ where: { workspaceId } }),
      prisma.task.findMany({
        where: { workspaceId },
        include: { assignee: true, creator: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.message.findMany({
        where: { task: { workspaceId } },
        include: { user: true, task: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    res.json({ openTasks, overdueTasks, completedTasks, memberCount, recentTasks, recentActivity });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Tasks list (filterable)
workspacesRouter.get("/:id/tasks", requireWorkspaceMember(), async (req, res) => {
  try {
    const prisma = getPrisma();
    const workspaceId = req.params.id;
    const status = req.query.status as string | undefined;
    const assignee = req.query.assignee as string | undefined;

    const where: any = { workspaceId };
    if (status) where.status = status;
    if (assignee) where.assigneeId = assignee;

    const tasks = await prisma.task.findMany({
      where,
      include: { assignee: true, creator: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (error) {
    console.error("Tasks list error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Members list
workspacesRouter.get("/:id/members", requireWorkspaceMember(), async (req, res) => {
  try {
    const members = await getMembersOfWorkspace(req.params.id);
    res.json(members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      role: m.role,
      preferredChannel: m.user.preferredChannel,
      joinedAt: m.joinedAt,
    })));
  } catch (error) {
    console.error("Members list error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// My tasks (current user only)
workspacesRouter.get("/:id/my-tasks", requireWorkspaceMember(), async (req, res) => {
  try {
    const prisma = getPrisma();
    const tasks = await prisma.task.findMany({
      where: { workspaceId: req.params.id, assigneeId: req.userId },
      include: { creator: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (error) {
    console.error("My tasks error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Activity feed
workspacesRouter.get("/:id/activity", requireWorkspaceMember(), async (req, res) => {
  try {
    const prisma = getPrisma();
    const messages = await prisma.message.findMany({
      where: { task: { workspaceId: req.params.id } },
      include: { user: true, task: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(messages);
  } catch (error) {
    console.error("Activity error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/api/workspaces.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/workspaces.ts tests/api/workspaces.test.ts
git commit -m "feat: add workspace API routes with dashboard, tasks, members, activity"
```

---

### Task 9: Invite & Onboarding API Routes

**Files:**
- Create: `src/api/invites.ts`
- Test: `tests/api/invites.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/invites.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/api/invites.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/api/invites.ts`:

```typescript
import { Router } from "express";
import { requireWorkspaceAdmin } from "../auth/middleware.js";
import { createInviteLink, validateInvite, consumeInvite, getActiveInvites, deactivateInvite } from "../db/invites.js";
import { addMember } from "../db/workspaces.js";
import { findUserByAddress, createUser } from "../db/users.js";
import { Channel } from "@prisma/client";

export const invitesRouter = Router();

// Admin: create invite link
invitesRouter.post("/workspaces/:id/invites", requireWorkspaceAdmin(), async (req, res) => {
  try {
    const invite = await createInviteLink({
      workspaceId: req.params.id,
      createdById: req.userId!,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      maxUses: req.body.maxUses,
    });
    const url = `${req.protocol}://${req.get("host")}/dashboard/invite/${invite.token}`;
    res.status(201).json({ id: invite.id, token: invite.token, url, expiresAt: invite.expiresAt, maxUses: invite.maxUses });
  } catch (error) {
    console.error("Create invite error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Admin: list active invites
invitesRouter.get("/workspaces/:id/invites", requireWorkspaceAdmin(), async (req, res) => {
  try {
    const invites = await getActiveInvites(req.params.id);
    res.json(invites);
  } catch (error) {
    console.error("List invites error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Admin: deactivate invite
invitesRouter.delete("/workspaces/:id/invites/:inviteId", requireWorkspaceAdmin(), async (req, res) => {
  try {
    await deactivateInvite(req.params.inviteId);
    res.json({ deactivated: true });
  } catch (error) {
    console.error("Deactivate invite error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Public: validate invite
invitesRouter.get("/invite/:token", async (req, res) => {
  try {
    const result = await validateInvite(req.params.token);
    res.json(result);
  } catch (error) {
    console.error("Validate invite error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Public: join via invite
invitesRouter.post("/invite/:token/join", async (req, res) => {
  try {
    const { name, preferredChannel, address } = req.body;
    if (!name || !preferredChannel || !address) {
      res.status(400).json({ error: "name, preferredChannel, and address are required" });
      return;
    }

    const validation = await validateInvite(req.params.token);
    if (!validation.valid) {
      res.status(400).json({ error: validation.reason });
      return;
    }

    // Find or create user
    let user = await findUserByAddress(address);
    if (!user) {
      user = await createUser({
        name,
        role: "member",
        preferredChannel: preferredChannel as Channel,
        addresses: [{ channel: preferredChannel as Channel, address }],
      });
    }

    // Add to workspace (upsert prevents duplicates)
    await addMember(validation.workspaceId!, user.id, "member");

    // Consume invite
    await consumeInvite(req.params.token);

    const { getPrisma } = await import("../db/client.js");
    const workspace = await getPrisma().workspace.findUnique({ where: { id: validation.workspaceId! } });

    res.status(201).json({
      user: { id: user.id, name: user.name },
      workspace: { id: workspace!.id, name: workspace!.name, slug: workspace!.slug },
    });
  } catch (error) {
    console.error("Join invite error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/api/invites.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/invites.ts tests/api/invites.test.ts
git commit -m "feat: add invite and onboarding API routes"
```

---

### Task 10: Update Task Creation to Include Workspace

**Files:**
- Modify: `src/db/tasks.ts`
- Modify: `src/router/router.ts`
- Modify: `src/db/users.ts`

- [ ] **Step 1: Add workspaceId to createTask in `src/db/tasks.ts`**

Update the `createTask` function signature and data:

```typescript
export async function createTask(data: {
  title: string;
  description?: string;
  assigneeId: string;
  creatorId: string;
  dueDate?: Date;
  workspaceId?: string;
}) {
  const prisma = getPrisma();
  return prisma.task.create({
    data: {
      title: data.title,
      description: data.description,
      assigneeId: data.assigneeId,
      creatorId: data.creatorId,
      dueDate: data.dueDate,
      workspaceId: data.workspaceId,
    },
    include: { assignee: true, creator: true },
  });
}
```

- [ ] **Step 2: Add findUserByNameInWorkspace to `src/db/users.ts`**

Add this function at the end of the file (it's also in workspaces.ts but having it here maintains the existing pattern for the router):

```typescript
export async function findUserByNameInWorkspace(workspaceId: string, name: string) {
  const prisma = getPrisma();
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { include: { addresses: true } } },
  });
  return members.find((m) => m.user.name.toLowerCase() === name.toLowerCase())?.user ?? null;
}
```

- [ ] **Step 3: Update router to resolve workspace context**

In `src/router/router.ts`, add workspace imports and update `handleInboundMessage` and `handleCreateTask`:

Add these imports at the top:

```typescript
import { getWorkspaceMemberships, findUserByNameInWorkspace } from "../db/workspaces.js";
```

Update `handleInboundMessage` — after resolving the sender (line 28-31), add workspace resolution:

```typescript
export async function handleInboundMessage(
  inbound: InboundMessage
): Promise<RouteResult> {
  // 1. Identify sender
  const sender = await resolveIdentity(inbound.senderAddress);
  if (!sender) {
    return { success: false, error: "Unknown sender: " + inbound.senderAddress };
  }

  // 2. Resolve workspace context
  const memberships = await getWorkspaceMemberships(sender.id);
  let workspaceId: string | undefined;
  if (memberships.length === 1) {
    workspaceId = memberships[0].workspaceId;
  } else if (memberships.length > 1) {
    // Check threading map for previously selected workspace
    const activeWs = getActiveWorkspaceForUser(sender.id);
    if (activeWs) {
      workspaceId = activeWs;
    }
    // If still no workspace and intent is create_task, will disambiguate later
  }
  // If no memberships, workspaceId stays undefined (backward compatible)

  // 3. Log inbound message
  await logMessage({
    userId: sender.id,
    channel: inbound.channel,
    direction: "inbound",
    rawText: inbound.messageText,
  });

  // 4. Get team member names for parser context
  const allUsers = await getAllUsers();
  const teamNames = allUsers.map((u) => u.name);
  const currentDate = new Date().toISOString().split("T")[0];

  // 5. Parse intent
  const parsed = await parseMessage(inbound.messageText, currentDate, teamNames);

  // 6. Low confidence — ask for clarification
  if (parsed.confidence < 0.7 && parsed.intent !== "unknown") {
    await sendToUser(sender.id, sender.preferredChannel, "I'm not sure what you mean. Could you rephrase that?");
    return { success: true, action: "clarification_requested" };
  }

  // 7. Route based on intent
  switch (parsed.intent) {
    case "create_task":
      return handleCreateTask(parsed, sender, inbound.channel, workspaceId);
    case "update_status":
      return handleUpdateStatus(parsed, sender, inbound.channel);
    case "add_comment":
      return handleAddComment(parsed, sender, inbound.channel);
    case "request_extension":
      return handleRequestExtension(parsed, sender, inbound.channel);
    case "unknown":
    default:
      await sendToUser(sender.id, sender.preferredChannel,
        "I didn't understand that. You can assign tasks (e.g., \"Jake needs to finish the logo by Friday\") or update them (e.g., \"done\", \"on it\")."
      );
      return { success: true, action: "unknown_intent" };
  }
}
```

Update `handleCreateTask` to accept and use workspaceId:

```typescript
async function handleCreateTask(parsed: any, sender: any, channel: Channel, workspaceId?: string): Promise<RouteResult> {
  if (!parsed.assigneeName || !parsed.taskTitle) {
    await sendToUser(sender.id, sender.preferredChannel,
      "I couldn't figure out who to assign this to or what the task is. Try something like: \"Jake needs to finish the logo by Friday\""
    );
    return { success: false, error: "Missing assignee or title" };
  }

  // If workspace is set, look up assignee within that workspace
  let assignee;
  if (workspaceId) {
    assignee = await findUserByNameInWorkspace(workspaceId, parsed.assigneeName);
    if (!assignee) {
      await sendToUser(sender.id, sender.preferredChannel, `I don't know anyone named "${parsed.assigneeName}" in this workspace. Check the name and try again.`);
      return { success: false, error: "Assignee not found in workspace: " + parsed.assigneeName };
    }
  } else {
    assignee = await findUserByName(parsed.assigneeName);
    if (!assignee) {
      await sendToUser(sender.id, sender.preferredChannel, `I don't know anyone named "${parsed.assigneeName}". Check the name and try again.`);
      return { success: false, error: "Assignee not found: " + parsed.assigneeName };
    }
  }

  const dueDate = parsed.dueDate ? new Date(parsed.dueDate) : undefined;
  const task = await createTask({ title: parsed.taskTitle, assigneeId: assignee.id, creatorId: sender.id, dueDate, workspaceId });

  await logMessage({ taskId: task.id, userId: sender.id, channel, direction: "inbound", rawText: `Created task: ${parsed.taskTitle}`, parsedIntent: JSON.stringify(parsed) });

  // Notify assignee
  const adapter = getAdapter(assignee.preferredChannel);
  const formattedMessage = adapter.formatTask({ title: task.title, status: task.status, dueDate: task.dueDate, creator: { name: sender.name } });
  const assigneeAddress = assignee.addresses.find((a: any) => a.channel === assignee.preferredChannel);
  if (assigneeAddress) {
    await adapter.sendMessage(assigneeAddress.address, formattedMessage);
    setActiveTaskForUser(assignee.id, task.id);
  }

  // Confirm to creator
  await sendToUser(sender.id, sender.preferredChannel,
    `Task created: "${task.title}" assigned to ${assignee.name}${dueDate ? ` (due ${dueDate.toLocaleDateString()})` : ""}`
  );

  return { success: true, action: "task_created", taskId: task.id };
}
```

- [ ] **Step 4: Add workspace threading to `src/router/threading.ts`**

Add these functions to the end of `src/router/threading.ts`:

```typescript
const activeWorkspaceMap = new Map<string, string>();

export function setActiveWorkspaceForUser(userId: string, workspaceId: string): void {
  activeWorkspaceMap.set(userId, workspaceId);
}

export function getActiveWorkspaceForUser(userId: string): string | null {
  return activeWorkspaceMap.get(userId) ?? null;
}
```

And add the import of `getActiveWorkspaceForUser` in `src/router/router.ts`:

```typescript
import {
  getActiveTaskForUser,
  setActiveTaskForUser,
  getOpenTasksForDisambiguation,
  formatDisambiguationMessage,
  getActiveWorkspaceForUser,
} from "./threading.js";
```

- [ ] **Step 5: Run all tests**

Run: `cd /Users/ryanhaugland/relay && npx vitest run`
Expected: All tests pass (existing router tests still work since workspaceId is optional)

- [ ] **Step 6: Commit**

```bash
git add src/db/tasks.ts src/db/users.ts src/router/router.ts src/router/threading.ts
git commit -m "feat: add workspace scoping to task creation and routing"
```

---

### Task 11: Update Scheduler to Include Workspace Context

**Files:**
- Modify: `src/scheduler/workers.ts`

- [ ] **Step 1: Update worker messages to include workspace name**

In `src/scheduler/workers.ts`, update `processOverdueCheck` to include workspace name:

```typescript
import { getOverdueTasks, getOpenTasksForUser, updateTaskStatus } from "../db/tasks.js";
import { getAllUsers, getUserWithAddresses } from "../db/users.js";
import { getAdapter } from "../adapters/index.js";
import { getPrisma } from "../db/client.js";

export async function processOverdueCheck(): Promise<void> {
  const overdueTasks = await getOverdueTasks();
  for (const task of overdueTasks) {
    if (task.status === "overdue") continue;
    await updateTaskStatus(task.id, "overdue");

    // Get workspace name if available
    let wsPrefix = "";
    if ((task as any).workspaceId) {
      const db = getPrisma();
      const ws = await db.workspace.findUnique({ where: { id: (task as any).workspaceId } });
      if (ws) wsPrefix = `[${ws.name}] `;
    }

    const assignee = await getUserWithAddresses(task.assigneeId);
    if (assignee) {
      const address = assignee.addresses.find((a) => a.channel === assignee.preferredChannel);
      if (address) {
        const adapter = getAdapter(assignee.preferredChannel);
        await adapter.sendMessage(address.address, `${wsPrefix}Task "${task.title}" is now overdue. Reply "done" if completed or give a new date.`);
      }
    }

    const creator = await getUserWithAddresses(task.creatorId);
    if (creator) {
      const address = creator.addresses.find((a) => a.channel === creator.preferredChannel);
      if (address) {
        const adapter = getAdapter(creator.preferredChannel);
        await adapter.sendMessage(address.address, `${wsPrefix}Heads up — "${task.title}" assigned to ${task.assignee.name} is overdue.`);
      }
    }
  }
}

export async function processDailyReminder(): Promise<void> {
  const users = await getAllUsers();
  for (const user of users) {
    const openTasks = await getOpenTasksForUser(user.id);
    if (openTasks.length === 0) continue;
    const taskLines = openTasks.map((t, i) => {
      const dueStr = t.dueDate ? ` (due ${t.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : "";
      return `${i + 1}) ${t.title}${dueStr}`;
    });
    const message = `You have ${openTasks.length} open task${openTasks.length > 1 ? "s" : ""}:\n${taskLines.join("\n")}`;
    const address = user.addresses.find((a) => a.channel === user.preferredChannel);
    if (address) {
      const adapter = getAdapter(user.preferredChannel);
      await adapter.sendMessage(address.address, message);
    }
  }
}

export async function processDueDateWarnings(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfTomorrow = new Date(tomorrow.toISOString().split("T")[0]);
  const endOfTomorrow = new Date(startOfTomorrow);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  const db = getPrisma();
  const tasksDueTomorrow = await db.task.findMany({
    where: { dueDate: { gte: startOfTomorrow, lt: endOfTomorrow }, status: { notIn: ["done"] } },
    include: { assignee: { include: { addresses: true } } },
  });
  for (const task of tasksDueTomorrow) {
    const address = task.assignee.addresses.find((a) => a.channel === task.assignee.preferredChannel);
    if (address) {
      const adapter = getAdapter(task.assignee.preferredChannel);
      await adapter.sendMessage(address.address, `Reminder: "${task.title}" is due tomorrow.`);
    }
  }
}
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/ryanhaugland/relay && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/scheduler/workers.ts
git commit -m "feat: add workspace name prefix to scheduler notifications"
```

---

### Task 12: Mount API Routes in Server

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Import and mount the new routers**

Add these imports at the top of `src/server.ts`:

```typescript
import { authRouter } from "./api/auth.js";
import { workspacesRouter } from "./api/workspaces.js";
import { invitesRouter } from "./api/invites.js";
```

Add these route mounts after the existing admin API routes (after line 102), before the `// Start server` comment:

```typescript
// Auth API
app.use("/api/auth", authRouter);

// Workspace API
app.use("/api/workspaces", workspacesRouter);

// Invite API (mixed auth — some routes public, some admin)
app.use("/api", invitesRouter);
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/ryanhaugland/relay && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Verify server starts**

Run: `cd /Users/ryanhaugland/relay && timeout 5 npx tsx src/server.ts 2>&1 || true`
Expected: See "Relay server running on port 3000" (may error on Redis connection, that's OK)

- [ ] **Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat: mount auth, workspace, and invite API routes on Express server"
```

---

### Task 13: End-to-End Workspace Flow Test

**Files:**
- Create: `tests/e2e/workspace-flow.test.ts`

- [ ] **Step 1: Write the E2E test**

Create `tests/e2e/workspace-flow.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser } from "../helpers/setup";
import { createWorkspace, addMember } from "../../src/db/workspaces";
import { createInviteLink, validateInvite, consumeInvite } from "../../src/db/invites";
import { createMagicLink, validateAndConsumeMagicLink } from "../../src/db/magic-links";
import { signToken, verifyToken } from "../../src/auth/jwt";
import { createTask } from "../../src/db/tasks";

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
```

- [ ] **Step 2: Run the E2E test**

Run: `cd /Users/ryanhaugland/relay && npx vitest run tests/e2e/workspace-flow.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Run full test suite**

Run: `cd /Users/ryanhaugland/relay && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/workspace-flow.test.ts
git commit -m "test: add end-to-end workspace lifecycle test"
```

---
