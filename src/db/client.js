import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

let prisma;
let loggedDatabaseFingerprint = false;

// Deliberately excludes username, password, query credentials and the full URL.
export function getDatabaseTargetFingerprint(databaseUrl) {
  if (typeof databaseUrl !== "string" || !databaseUrl.trim()) {
    throw new TypeError("A database URL is required to identify the persistence target.");
  }
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new TypeError("DATABASE_URL must be a valid URL.");
  }
  const identity = [
    parsed.hostname.toLowerCase(),
    parsed.port || "5432",
    parsed.pathname,
    parsed.searchParams.get("schema") || "public"
  ].join("|");
  return createHash("sha256").update(identity).digest("hex").slice(0, 12);
}

export function getPrismaClient(env = process.env) {
  if (!env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required to use Avero persistence.");
  }

  if (!prisma) {
    prisma = new PrismaClient();
    if (!loggedDatabaseFingerprint) {
      console.info("[Avero DB] persistence target fingerprint: " + getDatabaseTargetFingerprint(env.DATABASE_URL));
      loggedDatabaseFingerprint = true;
    }
  }

  return prisma;
}

export async function disconnectPrismaClient() {
  if (!prisma) return;

  const current = prisma;
  prisma = undefined;
  await current.$disconnect();
}
