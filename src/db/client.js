import { PrismaClient } from "@prisma/client";

let prisma;

export function getPrismaClient(env = process.env) {
  if (!env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required to use Avero persistence.");
  }

  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

export async function disconnectPrismaClient() {
  if (!prisma) return;

  const current = prisma;
  prisma = undefined;
  await current.$disconnect();
}
