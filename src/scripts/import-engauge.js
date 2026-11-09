import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createEngaugeClient } from "../bot/engauge-api.js";
import { importGuildProgress } from "../db/guild-progression-repository.js";

const guildId = process.env.ENGAUGE_SERVER_ID?.trim();
const apply = process.argv.includes("--apply");
if (!/^\d{17,20}$/.test(guildId ?? "")) {
  throw new Error("Set ENGAUGE_SERVER_ID to the Discord server ID to migrate.");
}
if (!process.env.ENGAUGE_API_TOKEN?.trim()) {
  throw new Error("Set ENGAUGE_API_TOKEN in the environment. Never pass it as a command-line argument.");
}
if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient();
try {
  const engauge = createEngaugeClient();
  const members = await engauge.getAllMembers(guildId, { order: "xp", direction: "desc", pageSize: 50 });
  const preview = {
    guildId,
    membersFetched: members.length,
    validDiscordMembers: members.filter((member) => /^\d{17,20}$/.test(String(member?.id ?? ""))).length,
    totalXp: members.reduce((sum, member) => sum + Math.max(0, Math.floor(Number(member?.totalXp ?? member?.xp ?? 0) || 0)), 0),
    totalMessages: members.reduce((sum, member) => sum + Math.max(0, Math.floor(Number(member?.messages ?? member?.messageCount ?? 0) || 0)), 0),
    totalVoiceSeconds: members.reduce((sum, member) => sum + Math.max(0, Math.floor(Number(member?.voiceSeconds ?? 0) || 0)), 0)
  };
  console.log("[Avero Engauge migration] Preview:", JSON.stringify(preview));
  if (!apply) {
    console.log("Dry run only. Review the preview, back up the Avero database, then rerun with --apply to import. Existing Avero records are never overwritten.");
  } else {
    const result = await importGuildProgress(prisma, guildId, members);
    console.log("[Avero Engauge migration] Import result:", JSON.stringify(result));
    console.log("Import complete. Verify sample member ranks and totals before removing Engauge credentials.");
  }
} finally {
  await prisma.$disconnect();
}
