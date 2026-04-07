import { PrismaClient, Channel, Role } from "@prisma/client";

export const testPrisma = new PrismaClient();

export async function cleanDatabase() {
  await testPrisma.message.deleteMany();
  await testPrisma.task.deleteMany();
  await testPrisma.userAddress.deleteMany();
  await testPrisma.user.deleteMany();
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
