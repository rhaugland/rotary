import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("telnyx", () => {
  const mockSend = vi.fn();

  function TelnyxConstructor(this: Record<string, unknown>) {
    this.messages = { send: mockSend };
  }
  (TelnyxConstructor as unknown as Record<string, unknown>).__mockSend = mockSend;

  return { default: TelnyxConstructor };
});

import Telnyx from "telnyx";
import { SmsAdapter } from "../../src/adapters/sms.js";

type TelnyxMock = ReturnType<typeof vi.fn> & {
  __mockSend: ReturnType<typeof vi.fn>;
};

const getMocks = () => {
  const t = Telnyx as unknown as TelnyxMock;
  return {
    messagesSend: t.__mockSend,
  };
};

const makeAdapter = () =>
  new SmsAdapter({
    apiKey: "KEY_test123",
    phoneNumber: "+15550001111",
    publicKey: "dGVzdHB1YmxpY2tleXRlc3RwdWJsaWNrZXk=", // 32-byte base64 placeholder
  });

describe("SmsAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("receiveMessage", () => {
    it("maps Telnyx webhook payload to InboundMessage", () => {
      const adapter = makeAdapter();
      const payload = {
        data: {
          payload: {
            from: { phone_number: "+15559876543" },
            text: "on it",
            id: "msg_abc123",
          },
        },
      };

      const result = adapter.receiveMessage(payload);

      expect(result.senderAddress).toBe("+15559876543");
      expect(result.messageText).toBe("on it");
      expect(result.channel).toBe("sms");
      expect(result.metadata).toEqual({ messageId: "msg_abc123" });
    });

    it("sets channel to sms regardless of payload content", () => {
      const adapter = makeAdapter();
      const result = adapter.receiveMessage({
        data: {
          payload: {
            from: { phone_number: "+10000000000" },
            text: "done",
            id: "msg_xyz",
          },
        },
      });
      expect(result.channel).toBe("sms");
    });
  });

  describe("formatTask", () => {
    it("formats a task with creator and due date", () => {
      const adapter = makeAdapter();
      const task = {
        title: "Design landing page",
        status: "todo",
        dueDate: new Date("2026-04-15T12:00:00Z"),
        creator: { name: "Ryan" },
      };

      const result = adapter.formatTask(task);

      expect(result).toContain("New task: Design landing page");
      expect(result).toContain("From: Ryan");
      expect(result).toContain("Due: Apr");
      expect(result).toContain('Reply "on it" to start or "done" when complete.');
    });

    it("formats a task without creator or due date", () => {
      const adapter = makeAdapter();
      const task = {
        title: "Review PRs",
        status: "todo",
      };

      const result = adapter.formatTask(task);

      expect(result).toContain("New task: Review PRs");
      expect(result).not.toContain("From:");
      expect(result).not.toContain("Due:");
      expect(result).toContain('Reply "on it" to start or "done" when complete.');
    });

    it("formats a task with null dueDate", () => {
      const adapter = makeAdapter();
      const result = adapter.formatTask({
        title: "Send invoice",
        status: "todo",
        dueDate: null,
      });
      expect(result).not.toContain("Due:");
    });

    it("formats a task with creator but no due date", () => {
      const adapter = makeAdapter();
      const result = adapter.formatTask({
        title: "Write tests",
        status: "in_progress",
        creator: { name: "Jake" },
      });
      expect(result).toContain("From: Jake");
      expect(result).not.toContain("Due:");
    });
  });

  describe("sendMessage", () => {
    it("calls telnyx messages.send and returns true on success", async () => {
      const { messagesSend } = getMocks();
      messagesSend.mockResolvedValue({ data: { id: "msg_sent123" } });
      const adapter = makeAdapter();

      const result = await adapter.sendMessage("+15559999999", "Hello from relay!");

      expect(messagesSend).toHaveBeenCalledWith({
        from: "+15550001111",
        to: "+15559999999",
        text: "Hello from relay!",
      });
      expect(result).toBe(true);
    });

    it("returns false and logs error when telnyx throws", async () => {
      const { messagesSend } = getMocks();
      messagesSend.mockRejectedValue(new Error("Telnyx API error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const adapter = makeAdapter();

      const result = await adapter.sendMessage("+15559999999", "Hello");

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith("SMS send failed:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("verifyWebhook", () => {
    it("returns false when telnyx-signature-ed25519 header is missing", () => {
      const adapter = makeAdapter();
      const result = adapter.verifyWebhook({
        headers: {},
        body: { data: { payload: { from: { phone_number: "+1555" }, text: "hi", id: "1" } } },
      });
      expect(result).toBe(false);
    });

    it("returns false when telnyx-timestamp header is missing", () => {
      const adapter = makeAdapter();
      const result = adapter.verifyWebhook({
        headers: { "telnyx-signature-ed25519": "somesig" },
        body: { data: { payload: { from: { phone_number: "+1555" }, text: "hi", id: "1" } } },
      });
      expect(result).toBe(false);
    });

    it("returns false when signature is invalid", () => {
      const adapter = makeAdapter();
      const result = adapter.verifyWebhook({
        headers: {
          "telnyx-signature-ed25519": "aW52YWxpZA==",
          "telnyx-timestamp": String(Math.floor(Date.now() / 1000)),
        },
        body: { data: { payload: { from: { phone_number: "+1555" }, text: "hi", id: "1" } } },
      });
      expect(result).toBe(false);
    });
  });

  describe("channel property", () => {
    it("has channel set to sms", () => {
      const adapter = makeAdapter();
      expect(adapter.channel).toBe("sms");
    });
  });
});
