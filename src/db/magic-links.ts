import crypto from "crypto";
import { getPrisma } from "./client.js";

const MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export async function createMagicLink(userId: string) {
  const prisma = getPrisma();
  const token = crypto.randomBytes(32).toString("base64url");
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
