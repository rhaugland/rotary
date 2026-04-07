import Telnyx from "telnyx";
import { createVerify } from "crypto";
import { ChannelAdapter, InboundMessage } from "./types.js";
import { Channel } from "@prisma/client";

interface TelnyxWebhookPayload {
  data: {
    payload: {
      from: { phone_number: string };
      text: string;
      id: string;
      [key: string]: unknown;
    };
  };
  [key: string]: unknown;
}

export class SmsAdapter implements ChannelAdapter {
  readonly channel: Channel = "sms";
  private client: InstanceType<typeof Telnyx>;
  private phoneNumber: string;
  private publicKey: string;

  constructor(config: { apiKey: string; phoneNumber: string; publicKey: string }) {
    this.client = new Telnyx({ apiKey: config.apiKey });
    this.phoneNumber = config.phoneNumber;
    this.publicKey = config.publicKey;
  }

  receiveMessage(rawPayload: unknown): InboundMessage {
    const payload = rawPayload as TelnyxWebhookPayload;
    return {
      senderAddress: payload.data.payload.from.phone_number,
      messageText: payload.data.payload.text,
      channel: "sms",
      metadata: { messageId: payload.data.payload.id },
    };
  }

  async sendMessage(recipientAddress: string, formattedMessage: string): Promise<boolean> {
    try {
      await this.client.messages.send({
        from: this.phoneNumber,
        to: recipientAddress,
        text: formattedMessage,
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
    const signature = request.headers["telnyx-signature-ed25519"];
    const timestamp = request.headers["telnyx-timestamp"];

    if (
      !signature ||
      typeof signature !== "string" ||
      !timestamp ||
      typeof timestamp !== "string"
    ) {
      return false;
    }

    try {
      const body =
        typeof request.body === "string"
          ? request.body
          : JSON.stringify(request.body);
      // Signed payload format: "<timestamp>|<body>"
      const signedPayload = `${timestamp}|${body}`;
      const signatureBytes = Buffer.from(signature, "base64");
      const publicKeyBytes = Buffer.from(this.publicKey, "base64");

      // Build DER-encoded Ed25519 public key (SubjectPublicKeyInfo)
      const derPrefix = Buffer.from("302a300506032b6570032100", "hex");
      const derPublicKey = Buffer.concat([derPrefix, publicKeyBytes]);
      const pemPublicKey = [
        "-----BEGIN PUBLIC KEY-----",
        derPublicKey.toString("base64"),
        "-----END PUBLIC KEY-----",
      ].join("\n");

      const verify = createVerify("Ed25519");
      verify.update(signedPayload);
      return verify.verify(pemPublicKey, signatureBytes);
    } catch {
      return false;
    }
  }
}
