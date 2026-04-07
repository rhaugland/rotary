import { Channel } from "@prisma/client";

export interface InboundMessage {
  senderAddress: string;
  messageText: string;
  channel: Channel;
  metadata: Record<string, unknown>;
}

export interface ChannelAdapter {
  readonly channel: Channel;

  receiveMessage(rawPayload: unknown): InboundMessage;

  sendMessage(
    recipientAddress: string,
    formattedMessage: string
  ): Promise<boolean>;

  formatTask(task: {
    title: string;
    status: string;
    dueDate?: Date | null;
    creator?: { name: string };
  }): string;

  verifyWebhook(request: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    url?: string;
  }): boolean;
}
