import sgMail from "@sendgrid/mail";
import { ChannelAdapter, InboundMessage } from "./types.js";
import { Channel } from "@prisma/client";

interface SendGridInboundPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  envelope: string;
  [key: string]: unknown;
}

export class EmailAdapter implements ChannelAdapter {
  readonly channel: Channel = "email";
  private fromEmail: string;
  private domain: string;

  constructor(config: { apiKey: string; fromEmail: string; domain: string }) {
    sgMail.setApiKey(config.apiKey);
    this.fromEmail = config.fromEmail;
    this.domain = config.domain;
  }

  receiveMessage(rawPayload: unknown): InboundMessage {
    const payload = rawPayload as SendGridInboundPayload;
    let taskAddress: string | undefined;
    try {
      const envelope = JSON.parse(payload.envelope);
      const toAddresses: string[] = envelope.to ?? [];
      taskAddress = toAddresses.find((addr: string) => addr.startsWith("task-"));
    } catch {
      taskAddress = payload.to;
    }
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
    const replyTo = taskId ? `task-${taskId}@${this.domain}` : this.fromEmail;
    try {
      await sgMail.send({
        to: recipientAddress,
        from: this.fromEmail,
        replyTo,
        subject: "Relay Task Update",
        text: formattedMessage,
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
