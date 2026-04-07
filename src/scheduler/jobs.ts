import { Queue } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | null = null;
let taskQueue: Queue | null = null;

export function initQueues(redisUrl: string): Queue {
  connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  taskQueue = new Queue("relay-tasks", { connection });
  return taskQueue;
}

export function getQueue(): Queue {
  if (!taskQueue) throw new Error("Queue not initialized. Call initQueues first.");
  return taskQueue;
}

export async function scheduleOverdueCheck(): Promise<void> {
  const queue = getQueue();
  await queue.add("overdue-check", {}, { repeat: { pattern: "0 * * * *" }, removeOnComplete: true });
}

export async function scheduleDailyReminder(): Promise<void> {
  const queue = getQueue();
  await queue.add("daily-reminder", {}, { repeat: { pattern: "0 9 * * *" }, removeOnComplete: true });
}

export async function scheduleDueDateWarnings(): Promise<void> {
  const queue = getQueue();
  await queue.add("due-date-warnings", {}, { repeat: { pattern: "0 9 * * *" }, removeOnComplete: true });
}
