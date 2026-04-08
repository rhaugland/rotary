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
