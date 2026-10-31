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

    const accountBefore = await tx.currencyAccount.findUnique({
      where: { guildId_userId: key }
    });
    const utcDay = (date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const daysSinceLastClaim = accountBefore.lastDailyAt
      ? Math.floor((utcDay(now) - utcDay(accountBefore.lastDailyAt)) / 86_400_000)
      : null;
    const dailyStreak = daysSinceLastClaim === 1 ? (accountBefore.dailyStreak ?? 0) + 1 : 1;

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
        lastDailyAt: now,
        dailyStreak
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
    return { claimed: true, amount, account, dailyStreak };
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
    if (foundItemId) {
      await tx.currencyTransaction.create({
        data: { ...key, amount: 0, type: "scavenge_collectible", createdAt: now }
      });
    }
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


export async function submitDailyVaultAttempt(
  prisma,
  guildId,
  userId,
  outcome,
  amount,
  { cooldownMs = 600_000, now = new Date() } = {}
) {
  const key = currencyKey(guildId, userId);
  if (!["win", "loss"].includes(outcome)) {
    throw new TypeError("Vault outcome must be win or loss.");
  }
  requirePositiveInteger(amount, "Vault reward");
  if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 1) {
    throw new TypeError("Vault reward cooldown must be a positive safe integer.");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }

  const contractDate = now.toISOString().slice(0, 10);
  const attemptKey = { ...key, contractDate, contractId: "vault_attempt" };
  const rewardKey = { ...key, contractDate, contractId: "vault_reward" };

  try {
    return await prisma.$transaction(async (tx) => {
      const existingAttempt = await tx.dailyContractClaim.findUnique({
        where: { guildId_userId_contractDate_contractId: attemptKey }
      });
      if (existingAttempt) {
        return { submitted: false, reason: "already_played" };
      }

      await tx.dailyContractClaim.create({
        data: { ...attemptKey, reward: 0, claimedAt: now }
      });
      await tx.currencyTransaction.create({
        data: { ...key, amount: 0, type: "vault_" + outcome, createdAt: now }
      });

      if (outcome !== "win") {
        return { submitted: true, reward: null };
      }

      const existingReward = await tx.dailyContractClaim.findUnique({
        where: { guildId_userId_contractDate_contractId: rewardKey }
      });
      if (existingReward) {
        const account = await tx.currencyAccount.findUnique({ where: { guildId_userId: key } });
        return { submitted: true, reward: { awarded: false, reason: "already_claimed", account } };
      }

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
      const account = await tx.currencyAccount.findUnique({ where: { guildId_userId: key } });
      if (updated.count === 0) {
        return { submitted: true, reward: { awarded: false, reason: "cooldown", account } };
      }
      if (updated.count !== 1) {
        throw new Error("Could not update the currency account for the Vault reward.");
      }

      await tx.dailyContractClaim.create({
        data: { ...rewardKey, reward: amount, claimedAt: now }
      });
      await tx.currencyTransaction.create({
        data: { ...key, amount, type: "vault_reward", createdAt: now }
      });
      const updatedAccount = await tx.currencyAccount.findUnique({ where: { guildId_userId: key } });
      return { submitted: true, reward: { awarded: true, amount, account: updatedAccount } };
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const existingAttempt = await prisma.dailyContractClaim.findUnique({
      where: { guildId_userId_contractDate_contractId: attemptKey }
    });
    if (!existingAttempt) throw error;
    return { submitted: false, reason: "already_played" };
  }
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
        const [existingAfterRace, account] = await Promise.all([
          tx.currencyPurchase.findUnique({
            where: { guildId_userId_itemId: { ...key, itemId } }
          }),
          tx.currencyAccount.findUnique({
            where: { guildId_userId: key }
          })
        ]);
        if (existingAfterRace) return { purchased: false, reason: "owned", account };
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
  const type = game === "guess" && outcome === "win" ? "guess_win_play" : game + "_" + outcome;
  return prisma.currencyTransaction.create({
    data: { ...key, amount: 0, type, createdAt: now }
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
  const lifetimeEarned = rows.reduce((total, row) => total + Math.max(0, row._sum?.amount ?? 0), 0);
  const lifetimeSpent = rows.reduce((total, row) => total + Math.max(0, -(row._sum?.amount ?? 0)), 0);
  const guessWins = count("guess_win_play") + count("guess_win");
  const guessLosses = count("guess_loss");
  const rpsWins = count("rps_win");
  const rpsLosses = count("rps_loss");
  const rpsTies = count("rps_tie");
  const vaultWins = count("vault_win");
  const vaultLosses = count("vault_loss");
  const coinflipWins = count("coinflip_win");
  const coinflipLosses = count("coinflip_loss");
  return {
    lifetimeEarned,
    lifetimeSpent,
    gameWins: guessWins + rpsWins + vaultWins + coinflipWins,
    guessWins,
    guessLosses,
    rpsWins,
    rpsLosses,
    rpsTies,
    vaultWins,
    vaultLosses,
    gameLosses: guessLosses + rpsLosses + vaultLosses + coinflipLosses,
    gameTies: rpsTies,
    gamesPlayed: guessWins + guessLosses + rpsWins + rpsLosses + rpsTies + vaultWins + vaultLosses + coinflipWins + coinflipLosses,
    dailyClaims: count("daily"),
    workShifts: count("work"),
    scavenges: count("scavenge"),
    itemsPurchased: count("shop_purchase")
  };
}


export const DAILY_CONTRACTS = Object.freeze([
  Object.freeze({ id: "work_shift", title: "Clock In", description: "Complete 2 work shifts", target: 2, reward: 80, transactionTypes: ["work"] }),
  Object.freeze({ id: "scavenge_trip", title: "Field Research", description: "Go scavenging 3 times", target: 3, reward: 90, transactionTypes: ["scavenge"] }),
  Object.freeze({ id: "game_session", title: "Game Regular", description: "Play 3 recorded game rounds", target: 3, reward: 75, transactionTypes: ["guess_win_play", "guess_win", "guess_loss", "rps_win", "rps_loss", "rps_tie", "vault_win", "vault_loss", "coinflip_win", "coinflip_loss"] }),
  Object.freeze({ id: "collector", title: "New Addition", description: "Unlock 1 collectible", target: 1, reward: 100, transactionTypes: ["shop_purchase", "scavenge_collectible"] })
]);

function getUtcContractDay(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }
  const contractDate = now.toISOString().slice(0, 10);
  const start = new Date(contractDate + "T00:00:00.000Z");
  return { contractDate, start, end: new Date(start.getTime() + 86_400_000) };
}

function getContractCounts(rows) {
  return new Map(rows.map((row) => [row.type, row._count?._all ?? 0]));
}

function buildContractProgress(counts, claimedIds) {
  return DAILY_CONTRACTS.map((contract) => {
    const progress = contract.transactionTypes.reduce((total, type) => total + (counts.get(type) ?? 0), 0);
    return {
      id: contract.id,
      title: contract.title,
      description: contract.description,
      target: contract.target,
      reward: contract.reward,
      progress: Math.min(progress, contract.target),
      complete: progress >= contract.target,
      claimed: claimedIds.has(contract.id)
    };
  });
}

async function getContractActivity(tx, guildId, userId, day) {
  const rows = await tx.currencyTransaction.groupBy({
    by: ["type"],
    where: {
      guildId,
      userId,
      createdAt: { gte: day.start, lt: day.end },
      type: { in: [...new Set(DAILY_CONTRACTS.flatMap((contract) => contract.transactionTypes))] }
    },
    _count: { _all: true }
  });
  return getContractCounts(rows);
}

export async function getDailyContracts(prisma, guildId, userId, { now = new Date() } = {}) {
  const key = currencyKey(guildId, userId);
  const day = getUtcContractDay(now);
  const [counts, claims] = await Promise.all([
    getContractActivity(prisma, key.guildId, key.userId, day),
    prisma.dailyContractClaim.findMany({
      where: { ...key, contractDate: day.contractDate },
      select: { contractId: true }
    })
  ]);
  return {
    date: day.contractDate,
    contracts: buildContractProgress(counts, new Set(claims.map((claim) => claim.contractId)))
  };
}

export async function claimDailyContract(prisma, guildId, userId, contractId, { now = new Date() } = {}) {
  const key = currencyKey(guildId, userId);
  if (typeof contractId !== "string" || !DAILY_CONTRACTS.some((contract) => contract.id === contractId)) {
    throw new TypeError("Unknown daily contract.");
  }
  const day = getUtcContractDay(now);
  const contract = DAILY_CONTRACTS.find((item) => item.id === contractId);
  const claimKey = { ...key, contractDate: day.contractDate, contractId };

  try {
    return await prisma.$transaction(async (tx) => {
      const counts = await getContractActivity(tx, key.guildId, key.userId, day);
      const progress = contract.transactionTypes.reduce((total, type) => total + (counts.get(type) ?? 0), 0);
      if (progress < contract.target) {
        return { claimed: false, reason: "incomplete", progress: Math.min(progress, contract.target), target: contract.target };
      }

      await tx.dailyContractClaim.create({
        data: { ...claimKey, reward: contract.reward, claimedAt: now }
      });
      await tx.currencyAccount.upsert({
        where: { guildId_userId: key },
        create: key,
        update: {}
      });
      const updated = await tx.currencyAccount.updateMany({
        where: key,
        data: { balance: { increment: contract.reward } }
      });
      if (updated.count !== 1) {
        throw new Error("Could not credit the daily contract reward.");
      }
      await tx.currencyTransaction.create({
        data: { ...key, amount: contract.reward, type: "contract_reward", createdAt: now }
      });
      const account = await tx.currencyAccount.findUnique({ where: { guildId_userId: key } });
      return { claimed: true, contractId, amount: contract.reward, account };
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const existing = await prisma.dailyContractClaim.findUnique({
      where: {
        guildId_userId_contractDate_contractId: claimKey
      }
    });
    if (!existing) throw error;
    const account = await prisma.currencyAccount.findUnique({ where: { guildId_userId: key } });
    return { claimed: false, reason: "already_claimed", account };
  }
}
