import { Channel, Role } from "@prisma/client";
import { getPrisma } from "./client.js";

export async function findUserByAddress(address: string) {
  const prisma = getPrisma();
  const userAddress = await prisma.userAddress.findUnique({
    where: { address },
    include: { user: { include: { addresses: true } } },
  });
  return userAddress?.user ?? null;
}

export async function createUser(data: {
  name: string;
  role: Role;
  preferredChannel: Channel;
  addresses: { channel: Channel; address: string }[];
}) {
  const prisma = getPrisma();
  return prisma.user.create({
    data: {
      name: data.name,
      role: data.role,
      preferredChannel: data.preferredChannel,
      addresses: {
        create: data.addresses,
      },
    },
    include: { addresses: true },
  });
}

export async function getUserWithAddresses(userId: string) {
  const prisma = getPrisma();
  return prisma.user.findUnique({
    where: { id: userId },
    include: { addresses: true },
  });
}

export async function findUserByName(name: string) {
  const prisma = getPrisma();
  return prisma.user.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    include: { addresses: true },
  });
}

export async function getAllUsers() {
  const prisma = getPrisma();
  return prisma.user.findMany({
    include: { addresses: true },
  });
}
