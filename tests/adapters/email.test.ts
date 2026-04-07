import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEmailsSend } = vi.hoisted(() => ({
  mockEmailsSend: vi.fn().mockResolvedValue({ id: "email_123" }),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return {
      emails: {
        send: mockEmailsSend,
      },
    };
  }),
}));

import { Resend } from "resend";
import { EmailAdapter } from "../../src/adapters/email.js";

const makeAdapter = () =>
  new EmailAdapter({
    apiKey: "re_test_api_key",
    fromEmail: "relay@example.com",
  });

describe("EmailAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailsSend.mockResolvedValue({ id: "email_123" });
  });

  describe("constructor", () => {
    it("instantiates Resend with the provided api key", () => {
      makeAdapter();
      expect(Resend).toHaveBeenCalledWith("re_test_api_key");
    });

    it("sets channel to email", () => {
      const adapter = makeAdapter();
      expect(adapter.channel).toBe("email");
    });
  });

  describe("receiveMessage", () => {
    it("extracts task address from payload.to when it starts with task-", () => {
      const adapter = makeAdapter();
      const payload = {
        from: "sender@client.com",
        to: "task-abc-123@relay.example.com",
        subject: "Re: Relay Task Update",
        text: "on it",
      };

      const result = adapter.receiveMessage(payload);

      expect(result.senderAddress).toBe("sender@client.com");
      expect(result.messageText).toBe("on it");
      expect(result.channel).toBe("email");
      expect(result.metadata.subject).toBe("Re: Relay Task Update");
      expect(result.metadata.taskAddress).toBe("task-abc-123@relay.example.com");
    });

    it("falls back to payload.to when to does not start with task-", () => {
      const adapter = makeAdapter();
      const payload = {
        from: "sender@client.com",
        to: "relay@example.com",
        subject: "Hello",
        text: "done",
      };

      const result = adapter.receiveMessage(payload);

      expect(result.metadata.taskAddress).toBe("relay@example.com");
    });

    it("sets channel to email regardless of payload content", () => {
      const adapter = makeAdapter();
      const payload = {
        from: "x@x.com",
        to: "y@y.com",
        subject: "s",
        text: "t",
      };
      const result = adapter.receiveMessage(payload);
      expect(result.channel).toBe("email");
    });
  });

  describe("formatTask", () => {
    it("formats a task with creator and due date", () => {
      const adapter = makeAdapter();
      const task = {
        title: "Build landing page",
        status: "todo",
        dueDate: new Date("2026-04-15T12:00:00Z"),
        creator: { name: "Ryan" },
      };

      const result = adapter.formatTask(task);

      expect(result).toContain("New Task: Build landing page");
      expect(result).toContain("From: Ryan");
      expect(result).toContain("Due:");
      expect(result).toContain("Apr");
      expect(result).toContain("Status: todo");
      expect(result).toContain("Reply to this email to update the task.");
      expect(result).toContain('"on it" = mark as in progress');
      expect(result).toContain('"done" = mark as complete');
    });

    it("formats a task without creator or due date", () => {
      const adapter = makeAdapter();
      const task = {
        title: "Review PRs",
        status: "todo",
      };

      const result = adapter.formatTask(task);

      expect(result).toContain("New Task: Review PRs");
      expect(result).not.toContain("From:");
      expect(result).toContain("No due date");
      expect(result).toContain("Status: todo");
    });

    it("formats a task with null dueDate", () => {
      const adapter = makeAdapter();
      const result = adapter.formatTask({
        title: "Send invoice",
        status: "in_progress",
        dueDate: null,
      });
      expect(result).toContain("No due date");
    });

    it("formats a task with creator but no due date", () => {
      const adapter = makeAdapter();
      const result = adapter.formatTask({
        title: "Write tests",
        status: "in_progress",
        creator: { name: "Jake" },
      });
      expect(result).toContain("From: Jake");
      expect(result).toContain("No due date");
    });

    it("includes weekday in due date format", () => {
      const adapter = makeAdapter();
      const result = adapter.formatTask({
        title: "Task",
        status: "todo",
        dueDate: new Date("2026-04-15T12:00:00Z"),
      });
      expect(result).toMatch(/Due: (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
    });
  });

  describe("sendMessage", () => {
    it("sends email with correct params and returns true on success", async () => {
      const adapter = makeAdapter();

      const result = await adapter.sendMessage("recipient@client.com", "Task updated!", "abc-123");

      expect(mockEmailsSend).toHaveBeenCalledWith({
        from: "relay@example.com",
        to: "recipient@client.com",
        subject: "Relay Task Update",
        text: "Task updated!",
        replyTo: "task-abc-123@example.com",
      });
      expect(result).toBe(true);
    });

    it("uses fromEmail domain for reply_to when taskId provided", async () => {
      const adapter = makeAdapter();

      await adapter.sendMessage("recipient@client.com", "Hello", "xyz-789");

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: "task-xyz-789@example.com" })
      );
    });

    it("uses fromEmail as reply_to when no taskId provided", async () => {
      const adapter = makeAdapter();

      await adapter.sendMessage("recipient@client.com", "Hello");

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: "relay@example.com" })
      );
    });

    it("returns false and logs error when resend.emails.send throws", async () => {
      mockEmailsSend.mockRejectedValue(new Error("Resend API error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const adapter = makeAdapter();

      const result = await adapter.sendMessage("recipient@client.com", "Hello");

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith("Email send failed:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("verifyWebhook", () => {
    it("always returns true", () => {
      const adapter = makeAdapter();
      const result = adapter.verifyWebhook({
        headers: {},
        body: {},
        url: "https://example.com/webhook/email",
      });
      expect(result).toBe(true);
    });
  });

  describe("extractTaskIdFromAddress", () => {
    it("extracts task id from a task- address", () => {
      const adapter = makeAdapter();
      expect(adapter.extractTaskIdFromAddress("task-abc-123@relay.example.com")).toBe("abc-123");
    });

    it("returns null when address does not start with task-", () => {
      const adapter = makeAdapter();
      expect(adapter.extractTaskIdFromAddress("relay@example.com")).toBeNull();
    });

    it("extracts alphanumeric task ids", () => {
      const adapter = makeAdapter();
      expect(adapter.extractTaskIdFromAddress("task-xyz789@domain.com")).toBe("xyz789");
    });
  });
});
