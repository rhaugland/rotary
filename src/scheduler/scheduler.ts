import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processOverdueCheck, processDailyReminder, processDueDateWarnings } from "./workers.js";
import { initQueues, scheduleOverdueCheck, scheduleDailyReminder, scheduleDueDateWarnings } from "./jobs.js";

export async function startScheduler(redisUrl: string): Promise<void> {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  initQueues(redisUrl);
  await scheduleOverdueCheck();
  await scheduleDailyReminder();
  await scheduleDueDateWarnings();

  const worker = new Worker("relay-tasks", async (job) => {
    switch (job.name) {
      case "overdue-check": await processOverdueCheck(); break;
      case "daily-reminder": await processDailyReminder(); break;
      case "due-date-warnings": await processDueDateWarnings(); break;
      default: console.warn("Unknown job:", job.name);
    }
  }, { connection });

  worker.on("completed", (job) => console.log(`Job ${job.name} completed`));
  worker.on("failed", (job, err) => console.error(`Job ${job?.name} failed:`, err));
  console.log("Scheduler started");
}
