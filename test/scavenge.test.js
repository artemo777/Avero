import test from "node:test";
import assert from "node:assert/strict";
import { claimScavengeReward } from "../src/db/currency-repository.js";

function fakePrisma() {
  const accounts = new Map();
  const purchases = new Map();
  const transactions = [];
  const accountKey = (guildId, userId) => guildId + ":" + userId;
  const purchaseKey = (guildId, userId, itemId) => accountKey(guildId, userId) + ":" + itemId;
  const prisma = {
    accounts, purchases, transactions,
    $transaction: (callback) => callback(prisma),
    currencyAccount: {
      async upsert({ where, create }) {
        const key = accountKey(where.guildId_userId.guildId, where.guildId_userId.userId);
        if (!accounts.has(key)) accounts.set(key, { ...create, balance: 0, lastDailyAt: null, lastWorkAt: null, lastScavengeAt: null });
        return accounts.get(key);
      },
      async updateMany({ where, data }) {
        const key = accountKey(where.guildId, where.userId);
        const account = accounts.get(key);
        if (!account) return { count: 0 };
        if (where.OR) {
          const allowed = where.OR.some((condition) => {
            if (Object.hasOwn(condition, "lastScavengeAt") && condition.lastScavengeAt === null) return account.lastScavengeAt === null;
            return Boolean(condition.lastScavengeAt?.lte && account.lastScavengeAt && account.lastScavengeAt <= condition.lastScavengeAt.lte);
          });
          if (!allowed) return { count: 0 };
        }
        if (data.balance?.increment) account.balance += data.balance.increment;
        if (data.lastScavengeAt) account.lastScavengeAt = data.lastScavengeAt;
        return { count: 1 };
      },
      async findUnique({ where }) {
        const key = accountKey(where.guildId_userId.guildId, where.guildId_userId.userId);
        const account = accounts.get(key);
        return account ? { ...account } : null;
      }
    },
    currencyPurchase: {
      async findUnique({ where }) {
        const key = where.guildId_userId_itemId;
        return purchases.get(purchaseKey(key.guildId, key.userId, key.itemId)) ?? null;
      },
      async create({ data }) {
        const key = purchaseKey(data.guildId, data.userId, data.itemId);
        if (purchases.has(key)) throw new Error("Unique purchase constraint");
        purchases.set(key, { ...data });
        return data;
      }
    },
    currencyTransaction: {
      async create({ data }) { transactions.push({ ...data }); return data; }
    }
  };
  return prisma;
}

test("scavenge pays coins, saves collectible drops, and records the transaction", async () => {
  const prisma = fakePrisma();
  const now = new Date("2026-10-28T12:00:00.000Z");
  const result = await claimScavengeReward(prisma, "guild-1", "user-1", {
    amount: 40, itemId: "neon_badge", now
  });

  assert.equal(result.claimed, true);
  assert.equal(result.amount, 40);
  assert.equal(result.itemId, "neon_badge");
  assert.equal(result.account.balance, 40);
  assert.equal(result.account.lastScavengeAt.getTime(), now.getTime());
  assert.equal(prisma.purchases.size, 1);
  assert.equal(prisma.transactions[0].type, "scavenge");
  assert.equal(prisma.transactions[0].amount, 40);
});

test("scavenge cooldown blocks duplicate payouts", async () => {
  const prisma = fakePrisma();
  const now = new Date("2026-10-28T12:00:00.000Z");
  await claimScavengeReward(prisma, "guild-1", "user-1", { amount: 35, now });
  const result = await claimScavengeReward(prisma, "guild-1", "user-1", {
    amount: 50, now: new Date(now.getTime() + 60_000)
  });

  assert.equal(result.claimed, false);
  assert.equal(result.account.balance, 35);
  assert.equal(prisma.transactions.length, 1);
});

test("duplicate scavenge drops award a coin bonus without duplicating collection", async () => {
  const prisma = fakePrisma();
  const now = new Date("2026-10-28T12:00:00.000Z");
  await claimScavengeReward(prisma, "guild-1", "user-1", {
    amount: 35, itemId: "neon_badge", now
  });
  const result = await claimScavengeReward(prisma, "guild-1", "user-1", {
    amount: 40, itemId: "neon_badge", now: new Date(now.getTime() + 600_000)
  });

  assert.equal(result.claimed, true);
  assert.equal(result.itemId, null);
  assert.equal(result.duplicateItemId, "neon_badge");
  assert.equal(result.bonus, 35);
  assert.equal(result.amount, 75);
  assert.equal(result.account.balance, 110);
  assert.equal(prisma.purchases.size, 1);
  assert.equal(prisma.transactions.length, 2);
});

test("scavenge validates reward, cooldown, item ID, and timestamp", async () => {
  const prisma = fakePrisma();
  await assert.rejects(claimScavengeReward(prisma, "g", "u", { amount: 0 }), /positive integer/);
  await assert.rejects(claimScavengeReward(prisma, "g", "u", { cooldownMs: 0 }), /positive safe integer/);
  await assert.rejects(claimScavengeReward(prisma, "g", "u", { itemId: "Not an item" }), /item ID/);
  await assert.rejects(claimScavengeReward(prisma, "g", "u", { now: new Date("invalid") }), /valid Date/);
});
