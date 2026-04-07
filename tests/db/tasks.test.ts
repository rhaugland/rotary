import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser } from "../helpers/setup";
import {
  createTask,
  updateTaskStatus,
  updateTaskDueDate,
  getTasksByAssignee,
  getOverdueTasks,
  getTaskById,
  getOpenTasksForUser,
} from "../../src/db/tasks";

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe("createTask", () => {
  it("creates a task with assignee and creator", async () => {
    const assignee = await createTestUser({
      name: "Assignee",
      addresses: [{ channel: "sms", address: "+15550000011" }],
    });
    const creator = await createTestUser({
      name: "Creator",
      addresses: [{ channel: "sms", address: "+15550000012" }],
    });

    const task = await createTask({
      title: "Fix the bug",
      description: "It's broken",
      assigneeId: assignee.id,
      creatorId: creator.id,
    });

    expect(task.title).toBe("Fix the bug");
    expect(task.description).toBe("It's broken");
    expect(task.status).toBe("open");
    expect(task.assignee.id).toBe(assignee.id);
    expect(task.creator.id).toBe(creator.id);
  });

  it("creates a task with a due date", async () => {
    const user = await createTestUser({
      name: "DueUser",
      addresses: [{ channel: "sms", address: "+15550000013" }],
    });
    const dueDate = new Date("2026-05-01T12:00:00Z");
    const task = await createTask({
      title: "Scheduled task",
      assigneeId: user.id,
      creatorId: user.id,
      dueDate,
    });

    expect(task.dueDate).toEqual(dueDate);
  });
});

describe("updateTaskStatus", () => {
  it("updates the status of a task", async () => {
    const user = await createTestUser({
      addresses: [{ channel: "sms", address: "+15550000021" }],
    });
    const task = await createTask({
      title: "Status test",
      assigneeId: user.id,
      creatorId: user.id,
    });

    const updated = await updateTaskStatus(task.id, "in_progress");
    expect(updated.status).toBe("in_progress");
  });
});

describe("updateTaskDueDate", () => {
  it("updates the due date of a task", async () => {
    const user = await createTestUser({
      addresses: [{ channel: "sms", address: "+15550000031" }],
    });
    const task = await createTask({
      title: "Due date test",
      assigneeId: user.id,
      creatorId: user.id,
    });

    const newDueDate = new Date("2026-06-15T09:00:00Z");
    const updated = await updateTaskDueDate(task.id, newDueDate);
    expect(updated.dueDate).toEqual(newDueDate);
  });
});

describe("getTasksByAssignee", () => {
  it("returns all tasks for an assignee", async () => {
    const user = await createTestUser({
      addresses: [{ channel: "sms", address: "+15550000041" }],
    });
    await createTask({ title: "Task A", assigneeId: user.id, creatorId: user.id });
    await createTask({ title: "Task B", assigneeId: user.id, creatorId: user.id });

    const tasks = await getTasksByAssignee(user.id);
    expect(tasks).toHaveLength(2);
  });

  it("filters by status when statusFilter is provided", async () => {
    const user = await createTestUser({
      addresses: [{ channel: "sms", address: "+15550000042" }],
    });
    const t1 = await createTask({ title: "Open task", assigneeId: user.id, creatorId: user.id });
    const t2 = await createTask({ title: "In progress task", assigneeId: user.id, creatorId: user.id });
    await updateTaskStatus(t2.id, "in_progress");

    const openTasks = await getTasksByAssignee(user.id, ["open"]);
    expect(openTasks).toHaveLength(1);
    expect(openTasks[0].id).toBe(t1.id);
  });
});

describe("getOverdueTasks", () => {
  it("returns tasks with past due dates that are not done", async () => {
    const user = await createTestUser({
      addresses: [{ channel: "sms", address: "+15550000051" }],
    });
    const pastDate = new Date("2025-01-01T00:00:00Z");
    await createTask({
      title: "Overdue task",
      assigneeId: user.id,
      creatorId: user.id,
      dueDate: pastDate,
    });

    const overdue = await getOverdueTasks();
    expect(overdue.length).toBeGreaterThanOrEqual(1);
    expect(overdue.some((t) => t.title === "Overdue task")).toBe(true);
  });

  it("does not return done tasks even if past due", async () => {
    const user = await createTestUser({
      addresses: [{ channel: "sms", address: "+15550000052" }],
    });
    const pastDate = new Date("2025-01-01T00:00:00Z");
    const task = await createTask({
      title: "Done overdue task",
      assigneeId: user.id,
      creatorId: user.id,
      dueDate: pastDate,
    });
    await updateTaskStatus(task.id, "done");

    const overdue = await getOverdueTasks();
    expect(overdue.some((t) => t.id === task.id)).toBe(false);
  });
});

describe("getTaskById", () => {
  it("returns a task with messages and relations", async () => {
    const user = await createTestUser({
      addresses: [{ channel: "sms", address: "+15550000061" }],
    });
    const task = await createTask({
      title: "Detailed task",
      assigneeId: user.id,
      creatorId: user.id,
    });

    const found = await getTaskById(task.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(task.id);
    expect(found?.messages).toBeDefined();
    expect(Array.isArray(found?.messages)).toBe(true);
  });

  it("returns null for unknown task id", async () => {
    const found = await getTaskById("00000000-0000-0000-0000-000000000000");
    expect(found).toBeNull();
  });
});

describe("getOpenTasksForUser", () => {
  it("returns open and in_progress tasks for a user", async () => {
    const user = await createTestUser({
      addresses: [{ channel: "sms", address: "+15550000071" }],
    });
    const t1 = await createTask({ title: "Open", assigneeId: user.id, creatorId: user.id });
    const t2 = await createTask({ title: "In Progress", assigneeId: user.id, creatorId: user.id });
    const t3 = await createTask({ title: "Done", assigneeId: user.id, creatorId: user.id });
    await updateTaskStatus(t2.id, "in_progress");
    await updateTaskStatus(t3.id, "done");

    const open = await getOpenTasksForUser(user.id);
    expect(open.some((t) => t.id === t1.id)).toBe(true);
    expect(open.some((t) => t.id === t2.id)).toBe(true);
    expect(open.some((t) => t.id === t3.id)).toBe(false);
  });
});
