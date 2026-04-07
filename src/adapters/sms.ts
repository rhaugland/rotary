import twilio from "twilio";
import { ChannelAdapter, InboundMessage } from "./types.js";
import { Channel } from "@prisma/client";

interface TwilioWebhookPayload {
  From: string;
  Body: string;
  MessageSid: string;
  AccountSid?: string;
  [key: string]: unknown;
}

export class SmsAdapter implements ChannelAdapter {
  readonly channel: Channel = "sms";
  private client: ReturnType<typeof twilio>;
  private phoneNumber: string;
  private authToken: string;

  constructor(config: { accountSid: string; authToken: string; phoneNumber: string }) {
    this.client = twilio(config.accountSid, config.authToken);
    this.phoneNumber = config.phoneNumber;
    this.authToken = config.authToken;
  }

  receiveMessage(rawPayload: unknown): InboundMessage {
    const payload = rawPayload as TwilioWebhookPayload;
    return {
      senderAddress: payload.From,
      messageText: payload.Body,
      channel: "sms",
      metadata: { messageSid: payload.MessageSid },
    };
  }

  async sendMessage(recipientAddress: string, formattedMessage: string): Promise<boolean> {
    try {
      await this.client.messages.create({
        body: formattedMessage,
        from: this.phoneNumber,
        to: recipientAddress,
      });
      return true;
    } catch (error) {
      console.error("SMS send failed:", error);
      return false;
    }
  }

  formatTask(task: {
    title: string;
    status: string;
    dueDate?: Date | null;
    creator?: { name: string };
  }): string {
    const dueLine = task.dueDate
      ? `\nDue: ${task.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : "";
    const fromLine = task.creator ? `\nFrom: ${task.creator.name}` : "";
    return `New task: ${task.title}${fromLine}${dueLine}\n\nReply "on it" to start or "done" when complete.`;
  }

  verifyWebhook(request: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    url?: string;
  }): boolean {
    const signature = request.headers["x-twilio-signature"];
    if (!signature || typeof signature !== "string" || !request.url) return false;
    return twilio.validateRequest(
      this.authToken,
      signature,
      request.url,
      request.body as Record<string, string>
    );
  }
}
