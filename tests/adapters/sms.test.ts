import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("twilio", () => {
  const mockCreate = vi.fn();
  const mockValidate = vi.fn();

  const twilioConstructor = vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  (twilioConstructor as unknown as Record<string, unknown>).validateRequest = mockValidate;
  (twilioConstructor as unknown as Record<string, unknown>).__mockCreate = mockCreate;
  (twilioConstructor as unknown as Record<string, unknown>).__mockValidate = mockValidate;

  return { default: twilioConstructor };
});

import twilio from "twilio";
import { SmsAdapter } from "../../src/adapters/sms.js";

type TwilioMock = ReturnType<typeof vi.fn> & {
  validateRequest: ReturnType<typeof vi.fn>;
  __mockCreate: ReturnType<typeof vi.fn>;
  __mockValidate: ReturnType<typeof vi.fn>;
};

const getMocks = () => {
  const t = twilio as unknown as TwilioMock;
  return {
    messagesCreate: t.__mockCreate,
    validateRequest: t.__mockValidate,
  };
};

const makeAdapter = () =>
  new SmsAdapter({
    accountSid: "ACtest123",
    authToken: "authtoken456",
    phoneNumber: "+15550001111",
  });

describe("SmsAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("receiveMessage", () => {
    it("maps Twilio webhook payload to InboundMessage", () => {
      const adapter = makeAdapter();
      const payload = {
        From: "+15559876543",
        Body: "on it",
        MessageSid: "SMabc123",
        AccountSid: "ACtest123",
      };

      const result = adapter.receiveMessage(payload);

      expect(result.senderAddress).toBe("+15559876543");
      expect(result.messageText).toBe("on it");
      expect(result.channel).toBe("sms");
      expect(result.metadata).toEqual({ messageSid: "SMabc123" });
    });

    it("sets channel to sms regardless of payload content", () => {
      const adapter = makeAdapter();
      const result = adapter.receiveMessage({
        From: "+10000000000",
        Body: "done",
        MessageSid: "SMxyz",
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
    it("calls twilio messages.create and returns true on success", async () => {
      const { messagesCreate } = getMocks();
      messagesCreate.mockResolvedValue({ sid: "SMsent123" });
      const adapter = makeAdapter();

      const result = await adapter.sendMessage("+15559999999", "Hello from relay!");

      expect(messagesCreate).toHaveBeenCalledWith({
        body: "Hello from relay!",
        from: "+15550001111",
        to: "+15559999999",
      });
      expect(result).toBe(true);
    });

    it("returns false and logs error when twilio throws", async () => {
      const { messagesCreate } = getMocks();
      messagesCreate.mockRejectedValue(new Error("Twilio API error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const adapter = makeAdapter();

      const result = await adapter.sendMessage("+15559999999", "Hello");

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith("SMS send failed:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("verifyWebhook", () => {
    it("returns false when x-twilio-signature header is missing", () => {
      const adapter = makeAdapter();
      const result = adapter.verifyWebhook({
        headers: {},
        body: { From: "+1555", Body: "hi" },
        url: "https://example.com/webhook/sms",
      });
      expect(result).toBe(false);
    });

    it("returns false when url is missing", () => {
      const adapter = makeAdapter();
      const result = adapter.verifyWebhook({
        headers: { "x-twilio-signature": "somesig" },
        body: { From: "+1555", Body: "hi" },
      });
      expect(result).toBe(false);
    });

    it("delegates to twilio.validateRequest and returns its result", () => {
      const { validateRequest } = getMocks();
      validateRequest.mockReturnValue(true);
      const adapter = makeAdapter();

      const result = adapter.verifyWebhook({
        headers: { "x-twilio-signature": "validsig" },
        body: { From: "+15559876543", Body: "done" },
        url: "https://example.com/webhook/sms",
      });

      expect(validateRequest).toHaveBeenCalledWith(
        "authtoken456",
        "validsig",
        "https://example.com/webhook/sms",
        { From: "+15559876543", Body: "done" }
      );
      expect(result).toBe(true);
    });

    it("returns false when twilio.validateRequest returns false", () => {
      const { validateRequest } = getMocks();
      validateRequest.mockReturnValue(false);
      const adapter = makeAdapter();

      const result = adapter.verifyWebhook({
        headers: { "x-twilio-signature": "badsig" },
        body: { From: "+1555", Body: "hi" },
        url: "https://example.com/webhook/sms",
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
