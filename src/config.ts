import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: parseInt(optionalEnv("PORT", "3000"), 10),
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  databaseUrl: requireEnv("DATABASE_URL"),
  redisUrl: requireEnv("REDIS_URL"),
  twilio: {
    accountSid: requireEnv("TWILIO_ACCOUNT_SID"),
    authToken: requireEnv("TWILIO_AUTH_TOKEN"),
    phoneNumber: requireEnv("TWILIO_PHONE_NUMBER"),
  },
  sendgrid: {
    apiKey: requireEnv("SENDGRID_API_KEY"),
    fromEmail: requireEnv("RELAY_FROM_EMAIL"),
    domain: requireEnv("RELAY_EMAIL_DOMAIN"),
  },
  googleChat: {
    serviceAccountKey: requireEnv("GOOGLE_CHAT_SERVICE_ACCOUNT_KEY"),
    projectId: requireEnv("GOOGLE_CHAT_PROJECT_ID"),
  },
  anthropic: {
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
  },
} as const;

export const prisma = new PrismaClient();
