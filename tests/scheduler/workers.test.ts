import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock adapter registry
const mockSendMessage = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/adapters/index", () => ({
  getAdapter: vi.fn(() => ({ sendMessage: mockSendMessage })),
}));

// Mock db functions
vi.mock("../../src/db/tasks", () => ({
  getOverdueTasks: vi.fn(),
  getOpenTasksForUser: vi.fn(),
  updateTaskStatus: vi.fn(),
}));

vi.mock("../../src/db/users", () => ({
  getAllUsers: vi.fn(),
  getUserWithAddresses: vi.fn(),
}));

import { processOverdueCheck, processDailyReminder } from "../../src/scheduler/workers";
import { getOverdueTasks, getOpenTasksForUser, updateTaskStatus } from "../../src/db/tasks";
import { getAllUsers, getUserWithAddresses } from "../../src/db/users";
import { getAdapter } from "../../src/adapters/index";

const mockGetOverdueTasks = vi.mocked(getOverdueTasks);
const mockGetOpenTasksForUser = vi.mocked(getOpenTasksForUser);
const mockUpdateTaskStatus = vi.mocked(updateTaskStatus);
const mockGetAllUsers = vi.mocked(getAllUsers);
const mockGetUserWithAddresses = vi.mocked(getUserWithAddresses);
const mockGetAdapter = vi.mocked(getAdapter);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAdapter.mockReturnValue({ sendMessage: mockSendMessage });
});

describe("processOverdueCheck", () => {
  it("marks open tasks as overdue and notifies assignee and creator", async () => {
    const assignee = {
      id: "user-1",
      name: "Alice",
      preferredChannel: "sms" as const,
      addresses: [{ channel: "sms" as const, address: "+15550000001" }],
    };
    const creator = {
      id: "user-2",
      name: "Bob",
      preferredChannel: "sms" as const,
      addresses: [{ channel: "sms" as const, address: "+15550000002" }],
    };
    const overdueTask = {
      id: "task-1",
      title: "Fix the leak",
      status: "open",
      assigneeId: assignee.id,
      creatorId: creator.id,
      assignee,
    };

    mockGetOverdueTasks.mockResolvedValue([overdueTask] as any);
    mockGetUserWithAddresses.mockImplementation(async (id: string) => {
      if (id === assignee.id) return assignee as any;
      if (id === creator.id) return creator as any;
      return null;
    });
    mockUpdateTaskStatus.mockResolvedValue({ ...overdueTask, status: "overdue" } as any);

    await processOverdueCheck();

    expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", "overdue");
    expect(mockSendMessage).toHaveBeenCalledWith(
      "+15550000001",
      'Task "Fix the leak" is now overdue. Reply "done" if completed or give a new date.'
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      "+15550000002",
      'Heads up — "Fix the leak" assigned to Alice is overdue.'
    );
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it("skips tasks that are already marked overdue", async () => {
    const user = {
      id: "user-3",
      name: "Carol",
      preferredChannel: "sms" as const,
      addresses: [{ channel: "sms" as const, address: "+15550000003" }],
    };
    const alreadyOverdueTask = {
      id: "task-2",
      title: "Already overdue",
      status: "overdue",
      assigneeId: user.id,
      creatorId: user.id,
      assignee: user,
    };

    mockGetOverdueTasks.mockResolvedValue([alreadyOverdueTask] as any);

    await processOverdueCheck();

    expect(mockUpdateTaskStatus).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("does not notify when assignee has no matching address for preferred channel", async () => {
    const assignee = {
      id: "user-4",
      name: "Dave",
      preferredChannel: "email" as const,
      addresses: [{ channel: "sms" as const, address: "+15550000004" }], // sms only, prefers email
    };
    const creator = {
      id: "user-5",
      name: "Eve",
      preferredChannel: "sms" as const,
      addresses: [{ channel: "sms" as const, address: "+15550000005" }],
    };
    const task = {
      id: "task-3",
      title: "No email task",
      status: "open",
      assigneeId: assignee.id,
      creatorId: creator.id,
      assignee,
    };

    mockGetOverdueTasks.mockResolvedValue([task] as any);
    mockGetUserWithAddresses.mockImplementation(async (id: string) => {
      if (id === assignee.id) return assignee as any;
      if (id === creator.id) return creator as any;
      return null;
    });
    mockUpdateTaskStatus.mockResolvedValue({ ...task, status: "overdue" } as any);

    await processOverdueCheck();

    expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-3", "overdue");
    // Only creator gets notified (has matching channel), not assignee
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith("+15550000005", expect.stringContaining("No email task"));
  });

  it("tasks with future due dates are not included in overdue check", async () => {
    // getOverdueTasks filters by dueDate < now at the DB level.
    // When no tasks are returned, processOverdueCheck should do nothing.
    mockGetOverdueTasks.mockResolvedValue([]);

    await processOverdueCheck();

    expect(mockUpdateTaskStatus).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});

describe("processDailyReminder", () => {
  it("sends a summary message to users with open tasks", async () => {
    const user = {
      id: "user-6",
      name: "Frank",
      preferredChannel: "sms" as const,
      addresses: [{ channel: "sms" as const, address: "+15550000006" }],
    };
    const openTasks = [
      { id: "task-4", title: "Write report", dueDate: new Date("2026-05-10T00:00:00Z"), assigneeId: user.id },
      { id: "task-5", title: "Review PR", dueDate: null, assigneeId: user.id },
    ];

    mockGetAllUsers.mockResolvedValue([user] as any);
    mockGetOpenTasksForUser.mockResolvedValue(openTasks as any);

    await processDailyReminder();

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [address, message] = mockSendMessage.mock.calls[0];
    expect(address).toBe("+15550000006");
    expect(message).toContain("You have 2 open tasks");
    expect(message).toContain("Write report");
    expect(message).toContain("Review PR");
  });

  it("skips users with no open tasks", async () => {
    const user = {
      id: "user-7",
      name: "Grace",
      preferredChannel: "sms" as const,
      addresses: [{ channel: "sms" as const, address: "+15550000007" }],
    };

    mockGetAllUsers.mockResolvedValue([user] as any);
    mockGetOpenTasksForUser.mockResolvedValue([]);

    await processDailyReminder();

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("sends singular task message when user has exactly one open task", async () => {
    const user = {
      id: "user-8",
      name: "Hank",
      preferredChannel: "sms" as const,
      addresses: [{ channel: "sms" as const, address: "+15550000008" }],
    };
    const openTasks = [{ id: "task-6", title: "Single task", dueDate: null, assigneeId: user.id }];

    mockGetAllUsers.mockResolvedValue([user] as any);
    mockGetOpenTasksForUser.mockResolvedValue(openTasks as any);

    await processDailyReminder();

    const [, message] = mockSendMessage.mock.calls[0];
    expect(message).toContain("You have 1 open task:");
    expect(message).not.toContain("tasks:");
  });

  it("includes due date in task line when present", async () => {
    const user = {
      id: "user-9",
      name: "Iris",
      preferredChannel: "sms" as const,
      addresses: [{ channel: "sms" as const, address: "+15550000009" }],
    };
    const dueDate = new Date("2026-06-15T00:00:00Z");
    const openTasks = [{ id: "task-7", title: "Dated task", dueDate, assigneeId: user.id }];

    mockGetAllUsers.mockResolvedValue([user] as any);
    mockGetOpenTasksForUser.mockResolvedValue(openTasks as any);

    await processDailyReminder();

    const [, message] = mockSendMessage.mock.calls[0];
    expect(message).toContain("due");
    expect(message).toContain("Dated task");
  });

  it("does not send to users with no matching address for preferred channel", async () => {
    const user = {
      id: "user-10",
      name: "Jack",
      preferredChannel: "email" as const,
      addresses: [{ channel: "sms" as const, address: "+15550000010" }], // no email address
    };
    const openTasks = [{ id: "task-8", title: "No channel task", dueDate: null, assigneeId: user.id }];

    mockGetAllUsers.mockResolvedValue([user] as any);
    mockGetOpenTasksForUser.mockResolvedValue(openTasks as any);

    await processDailyReminder();

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
