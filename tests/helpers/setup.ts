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
