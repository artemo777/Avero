const ID = /^\d{17,20}$/;
export const DEFAULT_XP_PER_LEVEL = 1000;

function validId(value, label) {
  const id = String(value ?? "");
  if (!ID.test(id)) throw new TypeError(label + " must be a valid Discord ID.");
  return id;
}

export function normalizeImportedMember(member) {
  const hasLevelProgress = member?.levelXp != null || member?.nextLevelXp != null;
  const rawXp = Math.max(0, Math.floor(Number(member?.xp ?? member?.totalXp ?? 0) || 0));
  // Without an explicit level-progress threshold, treat Engauge xp as cumulative only.
  const xp = hasLevelProgress ? rawXp : 0;
  const level = Math.max(0, Math.floor(Number(member?.level ?? 0) || 0));
  const nextLevelXp = Math.max(1, Math.floor(Number(member?.levelXp ?? member?.nextLevelXp ?? DEFAULT_XP_PER_LEVEL) || DEFAULT_XP_PER_LEVEL));
  const totalXp = Math.max(rawXp, Math.floor(Number(member?.totalXp ?? rawXp) || rawXp));
  const safeCount = (value) => Math.min(2_147_483_647, Math.max(0, Math.floor(Number(value) || 0)));
  return {
    xp: Math.min(2_147_483_647, xp),
    totalXp: Math.min(2_147_483_647, totalXp),
    level: Math.min(2_147_483_647, level),
    nextLevelXp: Math.min(2_147_483_647, nextLevelXp),
    messages: safeCount(member?.messages ?? member?.messageCount),
    voiceSeconds: safeCount(member?.voiceSeconds),
    currency: safeCount(member?.currency)
  };
}

export async function getGuildProgress(prisma, guildId, userId) {
  return prisma.guildMemberProgress.findUnique({
    where: { guildId_userId: { guildId: validId(guildId, "Guild ID"), userId: validId(userId, "Member ID") } }
  });
}

export async function grantGuildXp(prisma, guildId, userId, amount) {
  validId(guildId, "Guild ID");
  validId(userId, "Member ID");
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000) {
    throw new RangeError("XP amount must be an integer from 1 to 1,000,000.");
  }
  const key = { guildId, userId };
  await prisma.guildMemberProgress.upsert({
    where: { guildId_userId: key },
    create: { ...key, xp: amount, totalXp: amount },
    update: { xp: { increment: amount }, totalXp: { increment: amount } }
  });
  // Apply level transitions atomically against the exact XP value observed.
  for (let attempt = 0; attempt < 1001; attempt += 1) {
    const row = await getGuildProgress(prisma, guildId, userId);
    if (!row || row.xp < row.nextLevelXp) break;
    const nextThreshold = Math.min(2_147_483_647, Math.max(1, row.nextLevelXp + DEFAULT_XP_PER_LEVEL));
    const changed = await prisma.guildMemberProgress.updateMany({
      where: { id: row.id, xp: row.xp, level: row.level, nextLevelXp: row.nextLevelXp },
      data: { xp: { decrement: row.nextLevelXp }, level: { increment: 1 }, nextLevelXp: nextThreshold }
    });
    if (!changed.count) continue;
  }
  return getGuildProgress(prisma, guildId, userId);
}

export async function importGuildProgress(prisma, guildId, members, { importedAt = new Date() } = {}) {
  validId(guildId, "Guild ID");
  if (!Array.isArray(members)) throw new TypeError("Engauge members must be an array.");
  const rows = [];
  const seen = new Set();
  for (const member of members) {
    const userId = String(member?.id ?? "");
    if (!ID.test(userId) || seen.has(userId)) continue;
    seen.add(userId);
    rows.push({ guildId, userId, ...normalizeImportedMember(member), importedAt });
  }
  let created = 0;
  for (let offset = 0; offset < rows.length; offset += 500) {
    const result = await prisma.guildMemberProgress.createMany({
      data: rows.slice(offset, offset + 500),
      skipDuplicates: true
    });
    created += result.count;
  }
  return { fetched: members.length, valid: rows.length, created, alreadyPresent: rows.length - created };
}
