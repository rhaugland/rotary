// src/router/router.ts
import { Channel } from "@prisma/client";
import { InboundMessage } from "../adapters/types.js";
import { getAdapter } from "../adapters/index.js";
import { parseMessage } from "../parser/parser.js";
import { resolveIdentity } from "./identity.js";
import {
  getActiveTaskForUser,
  setActiveTaskForUser,
  getOpenTasksForDisambiguation,
  formatDisambiguationMessage,
  getActiveWorkspaceForUser,
} from "./threading.js";
import { createTask, updateTaskStatus, updateTaskDueDate, getTaskById } from "../db/tasks.js";
import { findUserByName, getAllUsers } from "../db/users.js";
import { getWorkspaceMemberships, findUserByNameInWorkspace } from "../db/workspaces.js";
import { logMessage } from "../db/messages.js";

interface RouteResult {
  success: boolean;
  action?: string;
  taskId?: string;
  error?: string;
}

export async function handleInboundMessage(
  inbound: InboundMessage
): Promise<RouteResult> {
  // 1. Identify sender
  const sender = await resolveIdentity(inbound.senderAddress);
  if (!sender) {
    return { success: false, error: "Unknown sender: " + inbound.senderAddress };
  }

  // 2. Resolve workspace context
  const memberships = await getWorkspaceMemberships(sender.id);
  let workspaceId: string | undefined;
  if (memberships.length === 1) {
    workspaceId = memberships[0].workspaceId;
  } else if (memberships.length > 1) {
    const activeWs = getActiveWorkspaceForUser(sender.id);
    if (activeWs) {
      workspaceId = activeWs;
    }
  }

  // 3. Log inbound message
  await logMessage({
    userId: sender.id,
    channel: inbound.channel,
    direction: "inbound",
    rawText: inbound.messageText,
  });

  // 4. Get team member names for parser context
  const allUsers = await getAllUsers();
  const teamNames = allUsers.map((u) => u.name);
  const currentDate = new Date().toISOString().split("T")[0];

  // 5. Parse intent
  const parsed = await parseMessage(inbound.messageText, currentDate, teamNames);

  // 6. Low confidence — ask for clarification
  if (parsed.confidence < 0.7 && parsed.intent !== "unknown") {
    await sendToUser(sender.id, sender.preferredChannel, "I'm not sure what you mean. Could you rephrase that?");
    return { success: true, action: "clarification_requested" };
  }

  // 7. Route based on intent
  switch (parsed.intent) {
    case "create_task":
      return handleCreateTask(parsed, sender, inbound.channel, workspaceId);
    case "update_status":
      return handleUpdateStatus(parsed, sender, inbound.channel);
    case "add_comment":
      return handleAddComment(parsed, sender, inbound.channel);
    case "request_extension":
      return handleRequestExtension(parsed, sender, inbound.channel);
    case "unknown":
    default:
      await sendToUser(sender.id, sender.preferredChannel,
        "I didn't understand that. You can assign tasks (e.g., \"Jake needs to finish the logo by Friday\") or update them (e.g., \"done\", \"on it\")."
      );
      return { success: true, action: "unknown_intent" };
  }
}

async function handleCreateTask(parsed: any, sender: any, channel: Channel, workspaceId?: string): Promise<RouteResult> {
  if (!parsed.assigneeName || !parsed.taskTitle) {
    await sendToUser(sender.id, sender.preferredChannel,
      "I couldn't figure out who to assign this to or what the task is. Try something like: \"Jake needs to finish the logo by Friday\""
    );
    return { success: false, error: "Missing assignee or title" };
  }

  let assignee;
  if (workspaceId) {
    assignee = await findUserByNameInWorkspace(workspaceId, parsed.assigneeName);
    if (!assignee) {
      await sendToUser(sender.id, sender.preferredChannel, `I don't know anyone named "${parsed.assigneeName}" in this workspace. Check the name and try again.`);
      return { success: false, error: "Assignee not found in workspace: " + parsed.assigneeName };
    }
  } else {
    assignee = await findUserByName(parsed.assigneeName);
    if (!assignee) {
      await sendToUser(sender.id, sender.preferredChannel, `I don't know anyone named "${parsed.assigneeName}". Check the name and try again.`);
      return { success: false, error: "Assignee not found: " + parsed.assigneeName };
    }
  }

  const dueDate = parsed.dueDate ? new Date(parsed.dueDate) : undefined;
  const task = await createTask({ title: parsed.taskTitle, assigneeId: assignee.id, creatorId: sender.id, dueDate, workspaceId });

  await logMessage({ taskId: task.id, userId: sender.id, channel, direction: "inbound", rawText: `Created task: ${parsed.taskTitle}`, parsedIntent: JSON.stringify(parsed) });

  // Notify assignee
  const adapter = getAdapter(assignee.preferredChannel);
  const formattedMessage = adapter.formatTask({ title: task.title, status: task.status, dueDate: task.dueDate, creator: { name: sender.name } });
  const assigneeAddress = assignee.addresses.find((a: any) => a.channel === assignee.preferredChannel);
  if (assigneeAddress) {
    await adapter.sendMessage(assigneeAddress.address, formattedMessage);
    setActiveTaskForUser(assignee.id, task.id);
  }

  // Confirm to creator
  await sendToUser(sender.id, sender.preferredChannel,
    `Task created: "${task.title}" assigned to ${assignee.name}${dueDate ? ` (due ${dueDate.toLocaleDateString()})` : ""}`
  );

  return { success: true, action: "task_created", taskId: task.id };
}

async function handleUpdateStatus(parsed: any, sender: any, channel: Channel): Promise<RouteResult> {
  const activeTaskId = getActiveTaskForUser(sender.id);

  if (!activeTaskId) {
    const openTasks = await getOpenTasksForDisambiguation(sender.id);
    if (openTasks.length === 0) {
      await sendToUser(sender.id, sender.preferredChannel, "You don't have any open tasks to update.");
      return { success: false, error: "No open tasks" };
    }
    if (openTasks.length === 1) {
      const task = openTasks[0];
      await updateTaskStatus(task.id, parsed.status);
      setActiveTaskForUser(sender.id, task.id);

      if (parsed.status === "done") {
        const fullTask = await getTaskById(task.id);
        if (fullTask) {
          await sendToUser(fullTask.creatorId, fullTask.creator.preferredChannel, `${sender.name} completed: "${fullTask.title}"`);
        }
      }
      return { success: true, action: "status_updated", taskId: task.id };
    }

    await sendToUser(sender.id, sender.preferredChannel, formatDisambiguationMessage(openTasks));
    return { success: true, action: "disambiguation_requested" };
  }

  const updated = await updateTaskStatus(activeTaskId, parsed.status);

  if (parsed.status === "done") {
    const fullTask = await getTaskById(activeTaskId);
    if (fullTask) {
      await sendToUser(fullTask.creatorId, fullTask.creator.preferredChannel, `${sender.name} completed: "${fullTask.title}"`);
    }
  }

  await sendToUser(sender.id, sender.preferredChannel, `Updated "${updated.title}" to ${parsed.status.replace("_", " ")}.`);
  return { success: true, action: "status_updated", taskId: activeTaskId };
}

async function handleAddComment(parsed: any, sender: any, channel: Channel): Promise<RouteResult> {
  const activeTaskId = getActiveTaskForUser(sender.id);
  if (!activeTaskId) {
    await sendToUser(sender.id, sender.preferredChannel, "I'm not sure which task you're commenting on. Could you clarify?");
    return { success: false, error: "No active task for comment" };
  }

  await logMessage({ taskId: activeTaskId, userId: sender.id, channel, direction: "inbound", rawText: parsed.comment ?? sender.name + " commented", parsedIntent: JSON.stringify(parsed) });

  const task = await getTaskById(activeTaskId);
  if (task) {
    const recipientId = task.creatorId === sender.id ? task.assigneeId : task.creatorId;
    const recipient = task.creatorId === sender.id ? task.assignee : task.creator;
    await sendToUser(recipientId, recipient.preferredChannel, `${sender.name} on "${task.title}": ${parsed.comment}`);
  }

  return { success: true, action: "comment_added", taskId: activeTaskId };
}

async function handleRequestExtension(parsed: any, sender: any, channel: Channel): Promise<RouteResult> {
  const activeTaskId = getActiveTaskForUser(sender.id);
  if (!activeTaskId) {
    await sendToUser(sender.id, sender.preferredChannel, "I'm not sure which task you want to extend. Could you clarify?");
    return { success: false, error: "No active task for extension" };
  }

  if (!parsed.dueDate) {
    await sendToUser(sender.id, sender.preferredChannel, "When do you need it pushed to? Reply with a date.");
    return { success: false, error: "No new date provided" };
  }

  const newDate = new Date(parsed.dueDate);
  await updateTaskDueDate(activeTaskId, newDate);

  const task = await getTaskById(activeTaskId);
  if (task) {
    await sendToUser(task.creatorId, task.creator.preferredChannel, `${sender.name} pushed "${task.title}" to ${newDate.toLocaleDateString()}`);
  }

  await sendToUser(sender.id, sender.preferredChannel, `Due date updated to ${newDate.toLocaleDateString()}.`);
  return { success: true, action: "extension_granted", taskId: activeTaskId };
}

async function sendToUser(userId: string, preferredChannel: Channel, message: string): Promise<void> {
  try {
    const { getUserWithAddresses } = await import("../db/users.js");
    const user = await getUserWithAddresses(userId);
    if (!user) return;
    const address = user.addresses.find((a) => a.channel === preferredChannel);
    if (!address) return;
    const adapter = getAdapter(preferredChannel);
    await adapter.sendMessage(address.address, message);
    await logMessage({ userId, channel: preferredChannel, direction: "outbound", rawText: message });
  } catch (error) { console.error("Failed to send to user:", userId, error); }
}
