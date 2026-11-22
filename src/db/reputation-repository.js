export const REPUTATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const REPUTATION_REASON_MAX_LENGTH = 180;

export function calculateReputation(positive = 0, negative = 0) {
  const up = Math.max(0, Number(positive) || 0);
  const down = Math.max(0, Number(negative) || 0);
  return Object.freeze({ positive: up, negative: down, net: up - down });
}

export async function getReputationSummary(prisma, guildId, userId) {
  const grouped = await prisma.reputationVote.groupBy({
    by: ["value"],
    where: { guildId, receiverId: userId, reversedAt: null },
    _count: { _all: true }
  });
  const positive = grouped.find((row) => row.value > 0)?._count._all ?? 0;
  const negative = grouped.find((row) => row.value < 0)?._count._all ?? 0;
  return { ...calculateReputation(positive, negative), total: positive + negative };
}

export async function giveReputation(prisma, {
  guildId, giverId, receiverId, value, reason = null, now = new Date(),
  cooldownMs = REPUTATION_COOLDOWN_MS
}) {
  if (!guildId || !giverId || !receiverId) throw new TypeError("A server, giver, and recipient are required.");
  if (giverId === receiverId) throw new RangeError("You cannot give reputation to yourself.");
  if (value !== 1 && value !== -1) throw new RangeError("Reputation must be positive or negative.");
  const cleanReason = typeof reason === "string" ? reason.trim().replace(/\s+/g, " ") : "";
  if (value < 0 && cleanReason.length < 3) throw new RangeError("Negative reputation needs a short, respectful reason (at least 3 characters).");
  if (cleanReason.length > REPUTATION_REASON_MAX_LENGTH) throw new RangeError("Reputation reasons must be 180 characters or fewer.");

  const cutoff = new Date(now.getTime() - cooldownMs);
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.reputationCooldown.upsert({
        where: { guildId_giverId: { guildId, giverId } },
        create: { guildId, giverId, lastGivenAt: null },
        update: {}
      });
      const claimed = await tx.reputationCooldown.updateMany({
        where: {
          guildId,
          giverId,
          OR: [{ lastGivenAt: null }, { lastGivenAt: { lte: cutoff } }]
        },
        data: { lastGivenAt: now }
      });
      if (claimed.count !== 1) {
        const cooldown = await tx.reputationCooldown.findUnique({
          where: { guildId_giverId: { guildId, giverId } }
        });
        const retryAt = new Date(cooldown.lastGivenAt.getTime() + cooldownMs);
        return { ok: false, code: "COOLDOWN", retryAt };
      }
      const vote = await tx.reputationVote.create({
        data: { guildId, giverId, receiverId, value, reason: cleanReason || null }
      });
      return { ok: true, vote };
    });
  } catch (error) {
    if (error?.code === "P2002" || error?.code === "P2034") {
      return { ok: false, code: "COOLDOWN", retryAt: new Date(now.getTime() + cooldownMs) };
    }
    throw error;
  }
}

export async function getReputationHistory(prisma, guildId, userId, take = 10) {
  return prisma.reputationVote.findMany({
    where: { guildId, receiverId: userId, reversedAt: null },
    orderBy: { createdAt: "desc" },
    take: Math.min(25, Math.max(1, take))
  });
}
