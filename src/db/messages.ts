import { Channel, MessageDirection } from "@prisma/client";

// Lazy-loaded prisma instance so tests can work without config env vars
let _prisma: import("@prisma/client").PrismaClient | null = null;
function getPrisma() {
  if (!_prisma) {
    const { PrismaClient } = require("@prisma/client");
    _prisma = new PrismaClient();
  }
  return _prisma!;
}

export async function logMessage(data: {
  taskId?: string;
  userId: string;
  channel: Channel;
  direction: MessageDirection;
  rawText: string;
  parsedIntent?: string;
}) {
  const prisma = getPrisma();
  return prisma.message.create({
    data: {
      taskId: data.taskId,
      userId: data.userId,
      channel: data.channel,
      direction: data.direction,
      rawText: data.rawText,
      parsedIntent: data.parsedIntent,
    },
  });
}

export async function getMessagesByTask(taskId: string) {
  const prisma = getPrisma();
  return prisma.message.findMany({
    where: { taskId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
}
