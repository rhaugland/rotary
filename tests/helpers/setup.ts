import "dotenv/config";
import { Channel, Role } from "@prisma/client";
import { getPrisma } from "../../src/db/client.js";

export const testPrisma = getPrisma();

export async function cleanDatabase() {
  await testPrisma.$executeRawUnsafe('TRUNCATE TABLE messages, tasks, user_addresses, users CASCADE');
}

export async function createTestUser(overrides: {
  name?: string;
  role?: Role;
  preferredChannel?: Channel;
  addresses?: { channel: Channel; address: string }[];
} = {}) {
  const user = await testPrisma.user.create({
    data: {
      name: overrides.name ?? "Test User",
      role: overrides.role ?? "member",
      preferredChannel: overrides.preferredChannel ?? "sms",
      addresses: {
        create: overrides.addresses ?? [
          { channel: "sms", address: "+15551234567" },
        ],
      },
    },
    include: { addresses: true },
  });
  return user;
}
