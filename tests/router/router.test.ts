// tests/router/router.test.ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { testPrisma, cleanDatabase, createTestUser } from "../helpers/setup.js";
import { handleInboundMessage } from "../../src/router/router.js";

vi.mock("../../src/parser/parser.js", () => ({
  parseMessage: vi.fn(),
}));

vi.mock("../../src/adapters/index.js", () => ({
  getAdapter: vi.fn(() => ({
    sendMessage: vi.fn().mockResolvedValue(true),
    formatTask: vi.fn().mockReturnValue("Formatted task message"),
  })),
}));

import { parseMessage } from "../../src/parser/parser.js";

describe("handleInboundMessage", () => {
  let jake: any;
  let ryan: any;

  beforeEach(async () => {
    await cleanDatabase();
    jake = await createTestUser({ name: "Jake", addresses: [{ channel: "sms", address: "+15551111111" }] });
    ryan = await createTestUser({ name: "Ryan", role: "admin", preferredChannel: "email", addresses: [{ channel: "email", address: "ryan@example.com" }] });
  });

  afterAll(async () => { await cleanDatabase(); await testPrisma.$disconnect(); });

  it("creates a task when intent is create_task", async () => {
    (parseMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      intent: "create_task", taskTitle: "finish the logo", assigneeName: "Jake", dueDate: "2026-04-11", confidence: 0.95,
    });
    const result = await handleInboundMessage({ senderAddress: "ryan@example.com", messageText: "Jake needs to finish the logo by Friday", channel: "email", metadata: {} });
    expect(result.success).toBe(true);
    expect(result.action).toBe("task_created");
    const tasks = await testPrisma.task.findMany({ where: { title: "finish the logo" } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].assigneeId).toBe(jake.id);
  });

  it("updates task status when intent is update_status", async () => {
    const task = await testPrisma.task.create({ data: { title: "finish the logo", assigneeId: jake.id, creatorId: ryan.id, status: "open" } });
    const { setActiveTaskForUser } = await import("../../src/router/threading.js");
    setActiveTaskForUser(jake.id, task.id);
    (parseMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ intent: "update_status", status: "done", confidence: 0.98 });
    const result = await handleInboundMessage({ senderAddress: "+15551111111", messageText: "done", channel: "sms", metadata: {} });
    expect(result.success).toBe(true);
    expect(result.action).toBe("status_updated");
    const updated = await testPrisma.task.findUnique({ where: { id: task.id } });
    expect(updated!.status).toBe("done");
  });

  it("returns error for unknown sender", async () => {
    const result = await handleInboundMessage({ senderAddress: "+19999999999", messageText: "hello", channel: "sms", metadata: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown sender");
  });
});
