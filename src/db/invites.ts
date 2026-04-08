import crypto from "crypto";
import { getPrisma } from "./client.js";

export async function createInviteLink(data: {
  workspaceId: string;
  createdById: string;
  expiresAt?: Date;
  maxUses?: number;
}) {
  const prisma = getPrisma();
  const token = crypto.randomBytes(32).toString("base64url");
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
