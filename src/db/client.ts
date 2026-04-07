import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    const pool = new pg.Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    _prisma = new PrismaClient({ adapter });
  }
  return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
