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
