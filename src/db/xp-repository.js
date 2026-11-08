const GLOBAL_SCOPE_ID = "__avero_global__";
const MAX_XP = 2_147_483_647;

function validateMemberXp(userId, amount) {
  if (typeof userId !== "string" || !/^\\d{17,20}$/.test(userId)) throw new TypeError("A valid Discord member ID is required.");
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000) throw new RangeError("XP amount must be an integer from 1 to 1,000,000.");
}

// Call inside an existing transaction so XP, level changes, and award receipts commit together.
export async function applyMemberXpInTransaction(tx, userId, amount) {
  validateMemberXp(userId, amount);
  const key = { guildId: GLOBAL_SCOPE_ID, userId };
  const current = await tx.memberProfile.upsert({
    where: { guildId_userId: key },
    create: { ...key, xp: amount, level: 0, nextLevelXp: 1000 },
    update: { xp: { increment: amount } }
  });
  if (current.xp > MAX_XP) throw new RangeError("Member XP exceeds the supported database range.");
  let level = Math.max(0, Number(current.level) || 0);
  let nextLevelXp = Math.max(1, Number(current.nextLevelXp) || current.xp + 1000);
  while (current.xp >= nextLevelXp && level < MAX_XP && nextLevelXp < MAX_XP) {
    level += 1;
    nextLevelXp = Math.min(MAX_XP, nextLevelXp + 1000);
  }
  const profile = level !== current.level || nextLevelXp !== current.nextLevelXp
    ? await tx.memberProfile.update({ where: { guildId_userId: key }, data: { level, nextLevelXp } })
    : current;
  return { previousLevel: current.level, profile };
}

export async function grantMemberXp(prisma, userId, amount) {
  return prisma.$transaction((tx) => applyMemberXpInTransaction(tx, userId, amount));
}
