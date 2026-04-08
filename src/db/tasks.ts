import { TaskStatus } from "@prisma/client";
import { getPrisma } from "./client.js";

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

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const prisma = getPrisma();
  return prisma.task.update({
    where: { id: taskId },
    data: { status },
    include: { assignee: true, creator: true },
  });
}

export async function updateTaskDueDate(taskId: string, dueDate: Date) {
  const prisma = getPrisma();
  return prisma.task.update({
    where: { id: taskId },
    data: { dueDate },
    include: { assignee: true, creator: true },
  });
}

export async function getTasksByAssignee(userId: string, statusFilter?: TaskStatus[]) {
  const prisma = getPrisma();
  return prisma.task.findMany({
    where: {
      assigneeId: userId,
      ...(statusFilter ? { status: { in: statusFilter } } : {}),
    },
    include: { assignee: true, creator: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOverdueTasks() {
  const prisma = getPrisma();
  return prisma.task.findMany({
    where: {
      dueDate: { lt: new Date() },
      status: { notIn: ["done"] },
    },
    include: { assignee: true, creator: true },
    orderBy: { dueDate: "asc" },
  });
}

export async function getTaskById(taskId: string) {
  const prisma = getPrisma();
  return prisma.task.findUnique({
    where: { id: taskId },
    include: { assignee: true, creator: true, messages: true },
  });
}

export async function getOpenTasksForUser(userId: string) {
  const prisma = getPrisma();
  return prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: { in: ["open", "in_progress", "overdue"] },
    },
    include: { creator: true },
    orderBy: { dueDate: "asc" },
  });
}
