import { getOverdueTasks, getOpenTasksForUser, updateTaskStatus } from "../db/tasks.js";
import { getAllUsers, getUserWithAddresses } from "../db/users.js";
import { getAdapter } from "../adapters/index.js";
import { getPrisma } from "../db/client.js";

export async function processOverdueCheck(): Promise<void> {
  const overdueTasks = await getOverdueTasks();
  for (const task of overdueTasks) {
    if (task.status === "overdue") continue;
    await updateTaskStatus(task.id, "overdue");

    // Get workspace name if available
    let wsPrefix = "";
    if ((task as any).workspaceId) {
      const db = getPrisma();
      const ws = await db.workspace.findUnique({ where: { id: (task as any).workspaceId } });
      if (ws) wsPrefix = `[${ws.name}] `;
    }

    const assignee = await getUserWithAddresses(task.assigneeId);
    if (assignee) {
      const address = assignee.addresses.find((a) => a.channel === assignee.preferredChannel);
      if (address) {
        const adapter = getAdapter(assignee.preferredChannel);
        await adapter.sendMessage(address.address, `${wsPrefix}Task "${task.title}" is now overdue. Reply "done" if completed or give a new date.`);
      }
    }

    const creator = await getUserWithAddresses(task.creatorId);
    if (creator) {
      const address = creator.addresses.find((a) => a.channel === creator.preferredChannel);
      if (address) {
        const adapter = getAdapter(creator.preferredChannel);
        await adapter.sendMessage(address.address, `${wsPrefix}Heads up — "${task.title}" assigned to ${task.assignee.name} is overdue.`);
      }
    }
  }
}

export async function processDailyReminder(): Promise<void> {
  const users = await getAllUsers();
  for (const user of users) {
    const openTasks = await getOpenTasksForUser(user.id);
    if (openTasks.length === 0) continue;
    const taskLines = openTasks.map((t, i) => {
      const dueStr = t.dueDate ? ` (due ${t.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : "";
      return `${i + 1}) ${t.title}${dueStr}`;
    });
    const message = `You have ${openTasks.length} open task${openTasks.length > 1 ? "s" : ""}:\n${taskLines.join("\n")}`;
    const address = user.addresses.find((a) => a.channel === user.preferredChannel);
    if (address) {
      const adapter = getAdapter(user.preferredChannel);
      await adapter.sendMessage(address.address, message);
    }
  }
}

export async function processDueDateWarnings(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfTomorrow = new Date(tomorrow.toISOString().split("T")[0]);
  const endOfTomorrow = new Date(startOfTomorrow);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  const { getPrisma } = await import("../db/client.js");
  const db = getPrisma();
  const tasksDueTomorrow = await db.task.findMany({
    where: { dueDate: { gte: startOfTomorrow, lt: endOfTomorrow }, status: { notIn: ["done"] } },
    include: { assignee: { include: { addresses: true } } },
  });
  for (const task of tasksDueTomorrow) {
    const address = task.assignee.addresses.find((a) => a.channel === task.assignee.preferredChannel);
    if (address) {
      const adapter = getAdapter(task.assignee.preferredChannel);
      await adapter.sendMessage(address.address, `Reminder: "${task.title}" is due tomorrow.`);
    }
  }
}
