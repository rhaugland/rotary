import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => {
  const mockSend = vi.fn();
  const mockSetApiKey = vi.fn();

  return {
    default: {
      setApiKey: mockSetApiKey,
      send: mockSend,
      __mockSend: mockSend,
      __mockSetApiKey: mockSetApiKey,
    },
  };
});

import sgMail from "@sendgrid/mail";
import { EmailAdapter } from "../../src/adapters/email.js";

type SgMailMock = typeof sgMail & {
  __mockSend: ReturnType<typeof vi.fn>;
  __mockSetApiKey: ReturnType<typeof vi.fn>;
};

const getMocks = () => {
  const sg = sgMail as unknown as SgMailMock;
  return {
    send: sg.__mockSend,
    setApiKey: sg.__mockSetApiKey,
  };
};

const makeAdapter = () =>
  new EmailAdapter({
    apiKey: "SG.test-api-key",
    fromEmail: "relay@example.com",
    domain: "mail.example.com",
  });

describe("EmailAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("calls sgMail.setApiKey with the provided api key", () => {
      const { setApiKey } = getMocks();
      makeAdapter();
      expect(setApiKey).toHaveBeenCalledWith("SG.test-api-key");
    });

    it("sets channel to email", () => {
      const adapter = makeAdapter();
      expect(adapter.channel).toBe("email");
    });
  });

  describe("receiveMessage", () => {
    it("extracts task address from envelope when present", () => {
      const adapter = makeAdapter();
      const payload = {
        from: "sender@client.com",
        to: "relay@mail.example.com",
        subject: "Re: Relay Task Update",
        text: "on it",
        envelope: JSON.stringify({
          to: ["task-abc-123@mail.example.com", "relay@mail.example.com"],
          from: "sender@client.com",
        }),
      };

      const result = adapter.receiveMessage(payload);

      expect(result.senderAddress).toBe("sender@client.com");
      expect(result.messageText).toBe("on it");
      expect(result.channel).toBe("email");
      expect(result.metadata.subject).toBe("Re: Relay Task Update");
      expect(result.metadata.taskAddress).toBe("task-abc-123@mail.example.com");
    });

    it("falls back to payload.to when no task- address is in envelope", () => {
      const adapter = makeAdapter();
      const payload = {
        from: "sender@client.com",
        to: "relay@mail.example.com",
        subject: "Hello",
        text: "done",
        envelope: JSON.stringify({
          to: ["relay@mail.example.com"],
          from: "sender@client.com",
        }),
      };

      const result = adapter.receiveMessage(payload);

      expect(result.metadata.taskAddress).toBe("relay@mail.example.com");
    });

    it("falls back to payload.to when envelope JSON is invalid", () => {
      const adapter = makeAdapter();
      const payload = {
        from: "sender@client.com",
        to: "relay@mail.example.com",
        subject: "Hello",
        text: "done",
        envelope: "not-valid-json",
      };

      const result = adapter.receiveMessage(payload);

      expect(result.metadata.taskAddress).toBe("relay@mail.example.com");
    });

    it("sets channel to email regardless of payload content", () => {
      const adapter = makeAdapter();
      const payload = {
        from: "x@x.com",
        to: "y@y.com",
        subject: "s",
        text: "t",
        envelope: "{}",
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
      // Should include a weekday name (Wednesday for Apr 15, 2026)
      expect(result).toMatch(/Due: (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
    });
  });

  describe("sendMessage", () => {
    it("sends email with correct params and returns true on success", async () => {
      const { send } = getMocks();
      send.mockResolvedValue([{ statusCode: 202 }]);
      const adapter = makeAdapter();

      const result = await adapter.sendMessage("recipient@client.com", "Task updated!", "abc-123");

      expect(send).toHaveBeenCalledWith({
        to: "recipient@client.com",
        from: "relay@example.com",
        replyTo: "task-abc-123@mail.example.com",
        subject: "Relay Task Update",
        text: "Task updated!",
      });
      expect(result).toBe(true);
    });

    it("uses fromEmail as replyTo when no taskId provided", async () => {
      const { send } = getMocks();
      send.mockResolvedValue([{ statusCode: 202 }]);
      const adapter = makeAdapter();

      await adapter.sendMessage("recipient@client.com", "Hello");

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: "relay@example.com" })
      );
    });

    it("returns false and logs error when sgMail.send throws", async () => {
      const { send } = getMocks();
      send.mockRejectedValue(new Error("SendGrid API error"));
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
      expect(adapter.extractTaskIdFromAddress("task-abc-123@mail.example.com")).toBe("abc-123");
    });

    it("returns null when address does not start with task-", () => {
      const adapter = makeAdapter();
      expect(adapter.extractTaskIdFromAddress("relay@mail.example.com")).toBeNull();
    });

    it("extracts alphanumeric task ids", () => {
      const adapter = makeAdapter();
      expect(adapter.extractTaskIdFromAddress("task-xyz789@domain.com")).toBe("xyz789");
    });
  });
});
