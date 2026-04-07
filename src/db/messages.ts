import { Channel, MessageDirection } from "@prisma/client";
import { getPrisma } from "./client.js";

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
