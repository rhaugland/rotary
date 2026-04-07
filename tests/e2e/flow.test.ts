// tests/e2e/flow.test.ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser } from "../helpers/setup.js";
import { handleInboundMessage } from "../../src/router/router.js";

// Mock the parser with realistic responses
vi.mock("../../src/parser/parser.js", () => ({
  parseMessage: vi.fn().mockImplementation(async (text: string) => {
    if (text.toLowerCase().includes("needs to")) {
      const match = text.match(/^(\w+) needs to (.+?)(?:\s+by\s+(.+))?$/i);
      return {
        intent: "create_task",
        assigneeName: match?.[1] ?? null,
        taskTitle: match?.[2] ?? text,
        dueDate: match?.[3] ? "2026-04-11" : null,
        confidence: 0.95,
      };
    }
    if (["done", "finished", "completed"].includes(text.toLowerCase())) {
      return { intent: "update_status", status: "done", confidence: 0.98 };
    }
    if (["on it", "working on it", "started"].includes(text.toLowerCase())) {
      return { intent: "update_status", status: "in_progress", confidence: 0.95 };
    }
    return { intent: "unknown", confidence: 0.3 };
  }),
}));

// Mock adapters
const mockSendMessage = vi.fn().mockResolvedValue(true);
vi.mock("../../src/adapters/index.js", () => ({
  getAdapter: vi.fn(() => ({
    sendMessage: mockSendMessage,
    formatTask: vi.fn().mockReturnValue("Formatted task notification"),
  })),
}));

describe("End-to-end task flow", () => {
  let ryan: any;
  let jake: any;

  beforeEach(async () => {
    await cleanDatabase();
    mockSendMessage.mockClear();
    ryan = await createTestUser({
      name: "Ryan", role: "admin", preferredChannel: "email",
      addresses: [{ channel: "email", address: "ryan@example.com" }],
    });
    jake = await createTestUser({
      name: "Jake",
      addresses: [{ channel: "sms", address: "+15551111111" }],
    });
  });

  afterAll(async () => { await cleanDatabase(); await testPrisma.$disconnect(); });

  it("full lifecycle: create → in progress → done", async () => {
    // Step 1: Ryan creates a task via email
    const createResult = await handleInboundMessage({
      senderAddress: "ryan@example.com", messageText: "Jake needs to finish the logo by Friday",
      channel: "email", metadata: {},
    });
    expect(createResult.success).toBe(true);
    expect(createResult.action).toBe("task_created");
    const tasks = await testPrisma.task.findMany();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("open");
    expect(mockSendMessage).toHaveBeenCalled();

    // Step 2: Jake replies "on it" via SMS
    mockSendMessage.mockClear();
    const progressResult = await handleInboundMessage({
      senderAddress: "+15551111111", messageText: "on it", channel: "sms", metadata: {},
    });
    expect(progressResult.success).toBe(true);
    expect(progressResult.action).toBe("status_updated");
    const updatedTask = await testPrisma.task.findFirst();
    expect(updatedTask!.status).toBe("in_progress");

    // Step 3: Jake replies "done" via SMS
    mockSendMessage.mockClear();
    const doneResult = await handleInboundMessage({
      senderAddress: "+15551111111", messageText: "done", channel: "sms", metadata: {},
    });
    expect(doneResult.success).toBe(true);
    expect(doneResult.action).toBe("status_updated");
    const completedTask = await testPrisma.task.findFirst();
    expect(completedTask!.status).toBe("done");
    expect(mockSendMessage).toHaveBeenCalled();
  });

  it("rejects messages from unknown senders", async () => {
    const result = await handleInboundMessage({
      senderAddress: "+19999999999", messageText: "hello", channel: "sms", metadata: {},
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown sender");
  });
});
