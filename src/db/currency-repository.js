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

export async function claimWorkReward(
  prisma,
  guildId,
  userId,
  { amount = 80, cooldownMs = 1_800_000, now = new Date() } = {}
) {
  const key = currencyKey(guildId, userId);
  requirePositiveInteger(amount, "Work reward");
  if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 1) {
    throw new TypeError("Work cooldown must be a positive safe integer.");
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
          { lastWorkAt: null },
          { lastWorkAt: { lte: new Date(now.getTime() - cooldownMs) } }
        ]
      },
      data: {
        balance: { increment: amount },
        lastWorkAt: now
      }
    });

    const account = await tx.currencyAccount.findUnique({
      where: { guildId_userId: key }
    });
    if (updated.count === 0) return { claimed: false, account };

    await tx.currencyTransaction.create({
      data: { ...key, amount, type: "work", createdAt: now }
    });
    return { claimed: true, amount, account };
  });
}

export async function claimScavengeReward(
  prisma,
  guildId,
  userId,
  { amount = 35, cooldownMs = 600_000, itemId = null, duplicateBonus = 35, now = new Date() } = {}
) {
  const key = currencyKey(guildId, userId);
  requirePositiveInteger(amount, "Scavenge reward");
  requirePositiveInteger(duplicateBonus, "Duplicate collectible bonus");
  if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 1) {
    throw new TypeError("Scavenge cooldown must be a positive safe integer.");
  }
  if (itemId !== null && (typeof itemId !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(itemId))) {
    throw new TypeError("Scavenge item ID must be a simple lowercase identifier.");
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
          { lastScavengeAt: null },
          { lastScavengeAt: { lte: new Date(now.getTime() - cooldownMs) } }
        ]
      },
      data: { balance: { increment: amount }, lastScavengeAt: now }
    });
    const account = await tx.currencyAccount.findUnique({ where: { guildId_userId: key } });
    if (updated.count === 0) return { claimed: false, account, itemFound: false };

    let foundItemId = null;
    let bonus = 0;
    if (itemId) {
      const existing = await tx.currencyPurchase.findUnique({
        where: { guildId_userId_itemId: { ...key, itemId } }
      });
      if (existing) {
        bonus = duplicateBonus;
        await tx.currencyAccount.updateMany({
          where: key,
          data: { balance: { increment: bonus } }
        });
      } else {
        await tx.currencyPurchase.create({ data: { ...key, itemId, purchasedAt: now } });
        foundItemId = itemId;
      }
    }
    const finalAccount = bonus
      ? await tx.currencyAccount.findUnique({ where: { guildId_userId: key } })
      : account;
    await tx.currencyTransaction.create({
      data: { ...key, amount: amount + bonus, type: "scavenge", createdAt: now }
    });
    return { claimed: true, amount: amount + bonus, baseAmount: amount, bonus, account: finalAccount, itemId: foundItemId, duplicateItemId: bonus ? itemId : null };
  });
}

export async function awardGameReward(
  prisma,
  guildId,
  userId,
  amount,
  { type = "game_reward", cooldownMs = 60_000, now = new Date() } = {}
) {
  const key = currencyKey(guildId, userId);
  requirePositiveInteger(amount, "Game reward");
  if (typeof type !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(type)) {
    throw new TypeError("Game reward type must be a simple lowercase identifier.");
  }
  if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 1) {
    throw new TypeError("Game reward cooldown must be a positive safe integer.");
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
          { lastGameRewardAt: null },
          { lastGameRewardAt: { lte: new Date(now.getTime() - cooldownMs) } }
        ]
      },
      data: {
        balance: { increment: amount },
        lastGameRewardAt: now
      }
    });
    const account = await tx.currencyAccount.findUnique({
      where: { guildId_userId: key }
    });
    if (updated.count === 0) return { awarded: false, reason: "cooldown", account };
    if (updated.count !== 1) {
      throw new Error("Could not update the currency account for the game reward.");
    }
    await tx.currencyTransaction.create({
      data: { ...key, amount, type, createdAt: now }
    });
    return { awarded: true, amount, account };
  });
}


export async function getCurrencyPurchases(prisma, guildId, userId) {
  const key = currencyKey(guildId, userId);
  return prisma.currencyPurchase.findMany({
    where: key,
    orderBy: { purchasedAt: "asc" }
  });
}

export async function purchaseCurrencyItem(
  prisma,
  guildId,
  userId,
  itemId,
  price,
  { now = new Date() } = {}
) {
  const key = currencyKey(guildId, userId);
  if (typeof itemId !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(itemId)) {
    throw new TypeError("Shop item ID must be a simple lowercase identifier.");
  }
  requirePositiveInteger(price, "Shop item price");
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.currencyAccount.upsert({
        where: { guildId_userId: key },
        create: key,
        update: {}
      });

      const existing = await tx.currencyPurchase.findUnique({
        where: { guildId_userId_itemId: { ...key, itemId } }
      });
      const accountBefore = await tx.currencyAccount.findUnique({
        where: { guildId_userId: key }
      });
      if (existing) return { purchased: false, reason: "owned", account: accountBefore };
      if (accountBefore.balance < price) {
        return { purchased: false, reason: "insufficient_funds", account: accountBefore };
      }

      const updated = await tx.currencyAccount.updateMany({
        where: { ...key, balance: { gte: price } },
        data: { balance: { decrement: price } }
      });
      if (updated.count !== 1) {
        const account = await tx.currencyAccount.findUnique({
          where: { guildId_userId: key }
        });
        return { purchased: false, reason: "insufficient_funds", account };
      }

      await tx.currencyPurchase.create({
        data: { ...key, itemId, purchasedAt: now }
      });
      await tx.currencyTransaction.create({
        data: { ...key, amount: -price, type: "shop_purchase", createdAt: now }
      });
      const account = await tx.currencyAccount.findUnique({
        where: { guildId_userId: key }
      });
      return { purchased: true, itemId, price, account };
    });
  } catch (error) {
    // A concurrent purchase of the same unique item can win after our initial
    // ownership check. Prisma rolls the losing transaction back; report the
    // normal "already owned" outcome instead of surfacing an internal error.
    if (error?.code !== "P2002") throw error;
    const [existing, account] = await Promise.all([
      prisma.currencyPurchase.findUnique({
        where: { guildId_userId_itemId: { ...key, itemId } }
      }),
      prisma.currencyAccount.findUnique({ where: { guildId_userId: key } })
    ]);
    if (!existing) throw error;
    return { purchased: false, reason: "owned", account };
  }
}


export async function recordGameResult(prisma, guildId, userId, game, outcome, { now = new Date() } = {}) {
  const key = currencyKey(guildId, userId);
  if (typeof game !== "string" || !/^[a-z][a-z0-9_]{0,19}$/.test(game)) {
    throw new TypeError("game must be a simple lowercase identifier.");
  }
  if (!["win", "loss", "tie"].includes(outcome)) {
    throw new TypeError("outcome must be win, loss, or tie.");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }
  return prisma.currencyTransaction.create({
    data: { ...key, amount: 0, type: game + "_" + outcome, createdAt: now }
  });
}

export async function recordGuessResult(prisma, guildId, userId, won, options = {}) {
  if (typeof won !== "boolean") throw new TypeError("won must be a boolean.");
  return recordGameResult(prisma, guildId, userId, "guess", won ? "win" : "loss", options);
}

export async function getCurrencyStats(prisma, guildId, userId) {
  const key = currencyKey(guildId, userId);
  const rows = await prisma.currencyTransaction.groupBy({
    by: ["type"],
    where: key,
    _count: { _all: true },
    _sum: { amount: true }
  });
  const byType = new Map(rows.map((row) => [row.type, row]));
  const count = (type) => byType.get(type)?._count?._all ?? 0;
  const amount = (type) => byType.get(type)?._sum?.amount ?? 0;
  const lifetimeEarned = rows.reduce((total, row) => total + Math.max(0, row._sum?.amount ?? 0), 0);
  const lifetimeSpent = rows.reduce((total, row) => total + Math.max(0, -(row._sum?.amount ?? 0)), 0);
  return {
    lifetimeEarned,
    lifetimeSpent,
    gameWins: count("guess_win_play") + count("rps_win"),
    guessWins: count("guess_win_play"),
    guessLosses: count("guess_loss"),
    rpsWins: count("rps_win"),
    rpsLosses: count("rps_loss"),
    rpsTies: count("rps_tie"),
    gameLosses: count("guess_loss") + count("rps_loss"),
    gameTies: count("rps_tie"),
    gamesPlayed: count("guess_win_play") + count("guess_loss") + count("rps_win") + count("rps_loss") + count("rps_tie"),
    dailyClaims: count("daily"),
    workShifts: count("work"),
    scavenges: count("scavenge"),
    itemsPurchased: count("shop_purchase")
  };
}
