const DAILY_CONTRACT_REWARD = 40;
const DAY_MS = 86_400_000;

const CONTRACTS = Object.freeze([
  Object.freeze({ id: "work_shift", title: "Clock In", description: "Complete 2 work shifts.", activity: "work", target: 2 }),
  Object.freeze({ id: "scavenge_run", title: "Field Research", description: "Complete 2 scavenging runs.", activity: "scavenge", target: 2 }),
  Object.freeze({ id: "game_round", title: "Playmaker", description: "Play 3 free game rounds.", activity: "games", target: 3 }),
  Object.freeze({ id: "collector", title: "Curator", description: "Unlock 1 collectible.", activity: "collectibles", target: 1 })
]);

function requireIdentifier(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(name + " must be a non-empty string.");
  }
  return value.trim();
}

function getUtcDay(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    date: start.toISOString().slice(0, 10),
    start,
    end: new Date(start.getTime() + DAY_MS)
  };
}

function getActiveContracts(date) {
  const dayNumber = Math.floor(Date.parse(date + "T00:00:00.000Z") / DAY_MS);
  const skippedIndex = ((dayNumber % CONTRACTS.length) + CONTRACTS.length) % CONTRACTS.length;
  return CONTRACTS.filter((_, index) => index !== skippedIndex);
}

async function getProgress(prisma, key, contract, start, end) {
  const createdAt = { gte: start, lt: end };
  switch (contract.activity) {
    case "work":
      return prisma.currencyTransaction.count({ where: { ...key, type: "work", createdAt } });
    case "scavenge":
      return prisma.currencyTransaction.count({ where: { ...key, type: "scavenge", createdAt } });
    case "games":
      return prisma.currencyTransaction.count({
        where: {
          ...key,
          type: { in: ["guess_win_play", "guess_win", "guess_loss", "rps_win", "rps_loss", "rps_tie"] },
          createdAt
        }
      });
    case "collectibles":
      return prisma.currencyPurchase.count({
        where: { ...key, purchasedAt: { gte: start, lt: end } }
      });
    default:
      throw new Error("Unknown daily contract activity.");
  }
}

export async function getDailyContracts(prisma, guildId, userId, { now = new Date() } = {}) {
  const key = {
    guildId: requireIdentifier(guildId, "guildId"),
    userId: requireIdentifier(userId, "userId")
  };
  const day = getUtcDay(now);
  const active = getActiveContracts(day.date);
  const [claims, ...progressValues] = await Promise.all([
    prisma.dailyContractClaim.findMany({
      where: { ...key, contractDate: day.date }
    }),
    ...active.map((contract) => getProgress(prisma, key, contract, day.start, day.end))
  ]);
  const claimedIds = new Set(claims.map((claim) => claim.contractId));
  return {
    date: day.date,
    contracts: active.map((contract, index) => {
      const progress = progressValues[index];
      return {
        ...contract,
        progress: Math.min(progress, contract.target),
        reward: DAILY_CONTRACT_REWARD,
        completed: progress >= contract.target,
        claimed: claimedIds.has(contract.id)
      };
    })
  };
}

export async function claimDailyContractReward(
  prisma,
  guildId,
  userId,
  contractId,
  { now = new Date() } = {}
) {
  const key = {
    guildId: requireIdentifier(guildId, "guildId"),
    userId: requireIdentifier(userId, "userId")
  };
  if (typeof contractId !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(contractId)) {
    throw new TypeError("contractId must be a simple lowercase identifier.");
  }
  const day = getUtcDay(now);
  const contract = getActiveContracts(day.date).find((candidate) => candidate.id === contractId);
  if (!contract) return { claimed: false, reason: "inactive" };

  try {
    return await prisma.$transaction(async (tx) => {
      const progress = await getProgress(tx, key, contract, day.start, day.end);
      if (progress < contract.target) {
        return { claimed: false, reason: "incomplete", progress };
      }

      await tx.dailyContractClaim.create({
        data: {
          ...key,
          contractId,
          contractDate: day.date,
          reward: DAILY_CONTRACT_REWARD,
          claimedAt: now
        }
      });
      await tx.currencyAccount.upsert({
        where: { guildId_userId: key },
        create: key,
        update: {}
      });
      await tx.currencyAccount.update({
        where: { guildId_userId: key },
        data: { balance: { increment: DAILY_CONTRACT_REWARD } }
      });
      await tx.currencyTransaction.create({
        data: { ...key, amount: DAILY_CONTRACT_REWARD, type: "contract_reward", createdAt: now }
      });
      const account = await tx.currencyAccount.findUnique({
        where: { guildId_userId: key }
      });
      return { claimed: true, reward: DAILY_CONTRACT_REWARD, account };
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const account = await prisma.currencyAccount.findUnique({
      where: { guildId_userId: key }
    });
    return { claimed: false, reason: "claimed", account };
  }
}
