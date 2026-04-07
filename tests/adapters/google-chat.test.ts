import { describe, it, expect, vi } from "vitest";
import { GoogleChatAdapter } from "../../src/adapters/google-chat.js";

vi.mock("googleapis", () => ({
  google: {
    chat: vi.fn(() => ({
      spaces: { messages: { create: vi.fn().mockResolvedValue({ data: { name: "spaces/123/messages/456" } }) } },
    })),
    auth: { GoogleAuth: vi.fn().mockImplementation(() => ({ getClient: vi.fn().mockResolvedValue({}) })) },
  },
}));

describe("GoogleChatAdapter", () => {
  const adapter = new GoogleChatAdapter({ serviceAccountKey: "{}", projectId: "test-project" });

  describe("receiveMessage", () => {
    it("extracts sender and message from Google Chat event", () => {
      const payload = {
        type: "MESSAGE",
        message: { text: "done", sender: { name: "users/123456", displayName: "Jake", email: "jake@example.com" }, space: { name: "spaces/AAAA", type: "DM" } },
      };
      const result = adapter.receiveMessage(payload);
      expect(result.senderAddress).toBe("jake@example.com");
      expect(result.messageText).toBe("done");
      expect(result.channel).toBe("google_chat");
    });
  });

  describe("formatTask", () => {
    it("formats a task for Google Chat", () => {
      const formatted = adapter.formatTask({ title: "Update website copy", status: "open", dueDate: new Date("2026-04-12"), creator: { name: "Ryan" } });
      expect(formatted).toContain("Update website copy");
      expect(formatted).toContain("Ryan");
    });
  });
});
