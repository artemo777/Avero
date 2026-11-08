import { createEngaugeClient } from "../src/bot/engauge-api.js";
import { getPrismaClient, disconnectPrismaClient } from "../src/db/client.js";

const ID = /^\\d{17,20}$/;
const MAX_INT = 2_147_483_647;
function integer(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MAX_INT ? parsed : fallback;
}

const serverId = process.env.ENGAUGE_SERVER_ID?.trim() || process.env.DISCORD_GUILD_ID?.trim();
if (!serverId || !ID.test(serverId)) throw new Error("Set ENGAUGE_SERVER_ID to the Discord server whose Engauge data should be imported.");
if (!process.env.ENGAUGE_API_TOKEN?.trim()) throw new Error("Set ENGAUGE_API_TOKEN in the one-time migration environment.");

const prisma = getPrismaClient();
try {
  const existing = await prisma.engaugeImportMarker.findUnique({ where: { serverId } });
  if (existing) throw new Error("An Engauge import for this server was already completed at " + existing.importedAt.toISOString() + ". Refusing to overwrite it.");
  const members = await createEngaugeClient().getAllMembers(serverId, { order: "xp", direction: "desc", pageSize: 50 });
  const valid = members.filter((member) => ID.test(String(member?.id ?? "")));
  if (!valid.length) throw new Error("Engauge returned no valid member records; no data was imported.");
  let imported = 0;
  for (const member of valid) {
    const userId = String(member.id), xp = integer(member.xp ?? member.totalXp), level = integer(member.level);
    const suppliedNext = integer(member.levelXp ?? member.nextLevelXp);
    const nextLevelXp = suppliedNext > xp ? suppliedNext : Math.min(MAX_INT, xp + 1000);
    await prisma.memberProfile.upsert({
      where: { guildId_userId: { guildId: "__avero_global__", userId } },
      create: { guildId: "__avero_global__", userId, xp, level, nextLevelXp, totalMessages: integer(member.messages ?? member.messageCount), totalVoiceSeconds: integer(member.voiceSeconds) },
      update: { xp, level, nextLevelXp, totalMessages: integer(member.messages ?? member.messageCount), totalVoiceSeconds: integer(member.voiceSeconds) }
    });
    imported += 1;
  }
  await prisma.engaugeImportMarker.create({ data: { serverId, memberCount: imported } });
  console.log("Imported " + imported + " Engauge member records into Avero. Verify ranks and leaderboards before removing migration credentials.");
} finally { await disconnectPrismaClient(); }
