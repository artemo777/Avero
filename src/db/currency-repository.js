function requireIdentifier(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(name + " must be a non-empty string.");
  }
  return value.trim();
}

function currencyKey(guildId, userId) {
  return {
    guildId: requireIdentifier(guildId, "guildId"),
    userId: requireIdentifier(userId, "userId")
  };
}

function requirePositiveInteger(value, name, max = 1_000_000) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new TypeError(name + " must be a positive integer no greater than " + max + ".");
  }
  return value;
}

export async function getCurrencyAccount(prisma, guildId, userId) {
  const key = currencyKey(guildId, userId);
  return prisma.currencyAccount.findUnique({ where: { guildId_userId: key } });
}

export async function claimDailyReward(
  prisma,
  guildId,
  userId,
  { amount = 100, cooldownMs = 86_400_000, now = new Date() } = {}
) {
  const key = currencyKey(guildId, userId);
  requirePositiveInteger(amount, "Daily reward amount");
  if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 1) {
    throw new TypeError("Daily cooldown must be a positive safe integer.");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.currencyAccount.upsert({
      where: { guildId_userId: key },
      create: key,
      update: {}
    });

    const updated = await tx.currencyAccount.updateMany({
      where: {
        ...key,
        OR: [
          { lastDailyAt: null },
          { lastDailyAt: { lte: new Date(now.getTime() - cooldownMs) } }
        ]
      },
      data: {
        balance: { increment: amount },
        lastDailyAt: now
      }
    });

    const account = await tx.currencyAccount.findUnique({
      where: { guildId_userId: key }
    });
    if (updated.count === 0) {
      return { claimed: false, account };
    }

    await tx.currencyTransaction.create({
      data: { ...key, amount, type: "daily", createdAt: now }
    });
    return { claimed: true, amount, account };
  });
}

export async function awardGameReward(
  prisma,
  guildId,
  userId,
  amount,
  { type = "game_reward", now = new Date() } = {}
) {
  const key = currencyKey(guildId, userId);
  requirePositiveInteger(amount, "Game reward");
  if (typeof type !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(type)) {
    throw new TypeError("Game reward type must be a simple lowercase identifier.");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.currencyAccount.upsert({
      where: { guildId_userId: key },
      create: key,
      update: {}
    });
    const updated = await tx.currencyAccount.updateMany({
      where: key,
      data: { balance: { increment: amount } }
    });
    if (updated.count !== 1) {
      throw new Error("Could not update the currency account for the game reward.");
    }
    const account = await tx.currencyAccount.findUnique({
      where: { guildId_userId: key }
    });
    await tx.currencyTransaction.create({
      data: { ...key, amount, type, createdAt: now }
    });
    return { awarded: true, amount, account };
  });
}
