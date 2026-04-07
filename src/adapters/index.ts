import { Channel } from "@prisma/client";
import { ChannelAdapter } from "./types.js";
import { SmsAdapter } from "./sms.js";
import { EmailAdapter } from "./email.js";
import { GoogleChatAdapter } from "./google-chat.js";

const adapters = new Map<Channel, ChannelAdapter>();

export function initAdapters(config: {
  twilio: { accountSid: string; authToken: string; phoneNumber: string };
  sendgrid: { apiKey: string; fromEmail: string; domain: string };
  googleChat: { serviceAccountKey: string; projectId: string };
}): void {
  adapters.set("sms", new SmsAdapter(config.twilio));
  adapters.set("email", new EmailAdapter(config.sendgrid));
  adapters.set("google_chat", new GoogleChatAdapter(config.googleChat));
}

export function getAdapter(channel: Channel): ChannelAdapter {
  const adapter = adapters.get(channel);
  if (!adapter) {
    throw new Error(`No adapter registered for channel: ${channel}`);
  }
  return adapter;
}

export function getAllAdapters(): ChannelAdapter[] {
  return Array.from(adapters.values());
}
