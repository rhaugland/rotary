import { getOpenTasksForUser } from "../db/tasks.js";

const activeTaskMap = new Map<string, string>();

export function setActiveTaskForUser(userId: string, taskId: string): void {
  activeTaskMap.set(userId, taskId);
}

export function getActiveTaskForUser(userId: string): string | null {
  return activeTaskMap.get(userId) ?? null;
}

export function clearActiveTaskForUser(userId: string): void {
  activeTaskMap.delete(userId);
}

export async function getOpenTasksForDisambiguation(userId: string) {
  return getOpenTasksForUser(userId);
}

export function formatDisambiguationMessage(
  tasks: { id: string; title: string; dueDate: Date | null }[]
): string {
  const lines = tasks.map(
    (t, i) =>
      `${i + 1}) ${t.title}${t.dueDate ? ` (due ${t.dueDate.toLocaleDateString()})` : ""}`
  );
  return `Which task? Reply with the number:\n${lines.join("\n")}`;
}
