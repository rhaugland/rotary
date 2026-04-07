import { ChannelAdapter, InboundMessage } from "./types.js";
import { Channel } from "@prisma/client";

interface GoogleChatEvent {
  type: string;
  message: {
    text: string;
    sender: { name: string; displayName: string; email: string };
    space: { name: string; type: string };
  };
}

export class GoogleChatAdapter implements ChannelAdapter {
  readonly channel: Channel = "google_chat";
  private projectId: string;

  constructor(config: { serviceAccountKey: string; projectId: string }) {
    this.projectId = config.projectId;
  }

  receiveMessage(rawPayload: unknown): InboundMessage {
    const event = rawPayload as GoogleChatEvent;
    return {
      senderAddress: event.message.sender.email,
      messageText: event.message.text,
      channel: "google_chat",
      metadata: {
        spaceName: event.message.space.name,
        senderName: event.message.sender.name,
        displayName: event.message.sender.displayName,
      },
    };
  }

  async sendMessage(recipientAddress: string, formattedMessage: string): Promise<boolean> {
    try {
      const { google } = await import("googleapis");
      const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/chat.bot"] });
      const chatClient = google.chat({ version: "v1", auth });
      await chatClient.spaces.messages.create({ parent: recipientAddress, requestBody: { text: formattedMessage } });
      return true;
    } catch (error) { console.error("Google Chat send failed:", error); return false; }
  }

  formatTask(task: { title: string; status: string; dueDate?: Date | null; creator?: { name: string } }): string {
    const dueLine = task.dueDate ? `Due: ${task.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "";
    const fromLine = task.creator ? `From: ${task.creator.name}` : "";
    return [`*New task:* ${task.title}`, fromLine, dueLine, "", 'Reply "on it" to start or "done" when complete.'].filter(Boolean).join("\n");
  }

  verifyWebhook(request: { headers: Record<string, string | string[] | undefined>; body: unknown; url?: string }): boolean {
    const authHeader = request.headers["authorization"];
    if (!authHeader || typeof authHeader !== "string") return false;
    return authHeader.startsWith("Bearer ");
  }
}
