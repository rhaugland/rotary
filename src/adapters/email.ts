import { Resend } from "resend";
import { ChannelAdapter, InboundMessage } from "./types.js";
import { Channel } from "@prisma/client";

interface ResendInboundPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  [key: string]: unknown;
}

export class EmailAdapter implements ChannelAdapter {
  readonly channel: Channel = "email";
  private fromEmail: string;
  private resend: Resend;

  constructor(config: { apiKey: string; fromEmail: string }) {
    this.resend = new Resend(config.apiKey);
    this.fromEmail = config.fromEmail;
  }

  receiveMessage(rawPayload: unknown): InboundMessage {
    const payload = rawPayload as ResendInboundPayload;
    const taskAddress = payload.to?.startsWith("task-") ? payload.to : undefined;
    return {
      senderAddress: payload.from,
      messageText: payload.text,
      channel: "email",
      metadata: {
        subject: payload.subject,
        taskAddress: taskAddress ?? payload.to,
      },
    };
  }

  async sendMessage(
    recipientAddress: string,
    formattedMessage: string,
    taskId?: string
  ): Promise<boolean> {
    const fromDomain = this.fromEmail.split("@")[1];
    const replyTo = taskId ? `task-${taskId}@${fromDomain}` : this.fromEmail;
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: recipientAddress,
        subject: "Relay Task Update",
        text: formattedMessage,
        replyTo,
      });
      return true;
    } catch (error) {
      console.error("Email send failed:", error);
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
      ? `Due: ${task.dueDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`
      : "No due date";
    const fromLine = task.creator ? `From: ${task.creator.name}` : "";
    return [
      `New Task: ${task.title}`,
      fromLine,
      dueLine,
      `Status: ${task.status}`,
      "",
      "Reply to this email to update the task.",
      '"on it" = mark as in progress',
      '"done" = mark as complete',
    ]
      .filter(Boolean)
      .join("\n");
  }

  verifyWebhook(_request: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    url?: string;
  }): boolean {
    return true;
  }

  extractTaskIdFromAddress(address: string): string | null {
    const match = address.match(/^task-([a-zA-Z0-9-]+)@/);
    return match ? match[1] : null;
  }
}
