import test from "node:test";
import assert from "node:assert/strict";
import { claimScavengeReward, claimWorkReward, getCurrencyAccount } from "../src/db/currency-repository.js";

function createPrisma() {
  const accounts = new Map();
  const transactions = [];
  const purchases = new Map();
  const keyOf = ({ guildId, userId }) => guildId + ":" + userId;
  const purchaseKey = ({ guildId, userId, itemId }) => keyOf({ guildId, userId }) + ":" + itemId;
  const prisma = {
    transactions,
    purchases,
    $transaction: (callback) => callback(prisma),
    currencyAccount: {
      async upsert({ where, create }) {
        const key = keyOf(where.guildId_userId);
        if (!accounts.has(key)) {
          accounts.set(key, {
            ...create,
            balance: 0,
            lastDailyAt: null,
            lastWorkAt: null,
            lastScavengeAt: null
          });
        }
        return accounts.get(key);
      },
      async findUnique({ where }) {
        const account = accounts.get(keyOf(where.guildId_userId));
        return account ? { ...account } : null;
      },
      async updateMany({ where, data }) {
        const account = accounts.get(keyOf(where));
        if (!account) return { count: 0 };
        if (where.balance?.gte !== undefined && account.balance < where.balance.gte) return { count: 0 };
        if (where.OR) {
          const timestampField = Object.keys(where.OR[0]).find((field) => field.startsWith("last"));
          const current = account[timestampField];
          const eligible = where.OR.some((condition) => {
            if (condition[timestampField] === null) return current === null;
            return current instanceof Date && current <= condition[timestampField].lte;
          });
          if (!eligible) return { count: 0 };
        }
        if (data.balance?.increment !== undefined) account.balance += data.balance.increment;
        if (data.balance?.decrement !== undefined) account.balance -= data.balance.decrement;
        for (const [field, value] of Object.entries(data)) {
          if (field.startsWith("last") && value !== undefined) account[field] = value;
        }
        return { count: 1 };
      }
    },
    currencyPurchase: {
      async findUnique({ where }) {
        return purchases.get(purchaseKey(where.guildId_userId_itemId)) ?? null;
      },
      async create({ data }) {
        purchases.set(purchaseKey(data), data);
        return data;
      }
    },
    currencyTransaction: {
      async create({ data }) {
        transactions.push(data);
        return data;
      }
    }
  };
  return prisma;
}

test("parallel work claims award a single reward inside the cooldown", async () => {
  const prisma = createPrisma();
  const now = new Date("2026-10-29T12:00:00.000Z");
  const results = await Promise.all([
    claimWorkReward(prisma, "guild-1", "user-1", { amount: 80, now }),
    claimWorkReward(prisma, "guild-1", "user-1", { amount: 80, now })
  ]);

  assert.equal(results.filter((result) => result.claimed).length, 1);
  assert.equal((await getCurrencyAccount(prisma, "guild-1", "user-1")).balance, 80);
  assert.equal(prisma.transactions.filter((transaction) => transaction.type === "work").length, 1);
});

test("parallel scavenge claims award coins and collectibles only once", async () => {
  const prisma = createPrisma();
  const now = new Date("2026-10-29T12:00:00.000Z");
  const results = await Promise.all([
    claimScavengeReward(prisma, "guild-1", "user-2", {
      amount: 35, itemId: "neon_badge", now
    }),
    claimScavengeReward(prisma, "guild-1", "user-2", {
      amount: 35, itemId: "neon_badge", now
    })
  ]);

  assert.equal(results.filter((result) => result.claimed).length, 1);
  assert.equal((await getCurrencyAccount(prisma, "guild-1", "user-2")).balance, 35);
  assert.equal(prisma.transactions.filter((transaction) => transaction.type === "scavenge").length, 1);
});

test("scavenge converts duplicate collectibles into a bonus and records the full reward", async () => {
  const prisma = createPrisma();
  const now = new Date("2026-10-29T13:00:00.000Z");
  prisma.purchases.set("guild-1:user-3:neon_badge", {
    guildId: "guild-1",
    userId: "user-3",
    itemId: "neon_badge",
    purchasedAt: new Date("2026-10-01T12:00:00.000Z")
  });

  const result = await claimScavengeReward(prisma, "guild-1", "user-3", {
    amount: 35,
    duplicateBonus: 35,
    itemId: "neon_badge",
    now
  });

  assert.equal(result.claimed, true);
  assert.equal(result.itemId, null);
  assert.equal(result.duplicateItemId, "neon_badge");
  assert.equal(result.baseAmount, 35);
  assert.equal(result.bonus, 35);
  assert.equal(result.amount, 70);
  assert.equal(result.account.balance, 70);
  assert.equal(prisma.transactions.length, 1);
  assert.equal(prisma.transactions[0].amount, 70);
  assert.equal(prisma.purchases.size, 1);
});

test("a scavenge claim blocked by cooldown creates no reward ledger entry", async () => {
  const prisma = createPrisma();
  const firstAt = new Date("2026-10-29T13:00:00.000Z");
  await claimScavengeReward(prisma, "guild-1", "user-4", {
    amount: 35,
    itemId: "neon_badge",
    now: firstAt
  });

  const blocked = await claimScavengeReward(prisma, "guild-1", "user-4", {
    amount: 35,
    itemId: "vault_badge",
    now: new Date(firstAt.getTime() + 1)
  });

  assert.equal(blocked.claimed, false);
  assert.equal(blocked.account.balance, 35);
  assert.equal(prisma.transactions.length, 1);
  assert.equal(prisma.purchases.size, 1);
});
