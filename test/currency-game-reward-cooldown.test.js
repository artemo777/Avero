import test from "node:test";
import assert from "node:assert/strict";
import { awardGameReward } from "../src/db/currency-repository.js";

function createPrisma() {
  const accounts = new Map();
  const transactions = [];
  const keyOf = ({ guildId, userId }) => guildId + ":" + userId;
  const prisma = {
    transactions,
    $transaction: (callback) => callback(prisma),
    currencyAccount: {
      async upsert({ where, create }) {
        const key = keyOf(where.guildId_userId);
        if (!accounts.has(key)) {
          accounts.set(key, {
            ...create,
            balance: 0,
            lastGameRewardAt: null
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
        const eligible = where.OR?.some((condition) => {
          if (condition.lastGameRewardAt === null) return account.lastGameRewardAt === null;
          return account.lastGameRewardAt instanceof Date &&
            account.lastGameRewardAt <= condition.lastGameRewardAt.lte;
        });
        if (!eligible) return { count: 0 };
        account.balance += data.balance.increment;
        account.lastGameRewardAt = data.lastGameRewardAt;
        return { count: 1 };
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

test("concurrent game wins award coins only once inside the reward cooldown", async () => {
  const prisma = createPrisma();
  const now = new Date("2026-10-29T12:00:00.000Z");
  const results = await Promise.all([
    awardGameReward(prisma, "guild-1", "user-1", 25, { type: "guess_reward", cooldownMs: 60_000, now }),
    awardGameReward(prisma, "guild-1", "user-1", 25, { type: "guess_reward", cooldownMs: 60_000, now })
  ]);

  assert.equal(results.filter((result) => result.awarded).length, 1);
  assert.equal(results.filter((result) => result.reason === "cooldown").length, 1);
  assert.equal((await prisma.currencyAccount.findUnique({
    where: { guildId_userId: { guildId: "guild-1", userId: "user-1" } }
  })).balance, 25);
  assert.equal(prisma.transactions.length, 1);
  assert.equal(prisma.transactions[0].amount, 25);
});

test("game reward cooldown expires at the exact cooldown boundary", async () => {
  const prisma = createPrisma();
  const firstAt = new Date("2026-10-29T12:00:00.000Z");
  const first = await awardGameReward(prisma, "guild-1", "user-2", 25, {
    type: "guess_reward", cooldownMs: 60_000, now: firstAt
  });
  const early = await awardGameReward(prisma, "guild-1", "user-2", 25, {
    type: "guess_reward", cooldownMs: 60_000, now: new Date(firstAt.getTime() + 59_999)
  });
  const ready = await awardGameReward(prisma, "guild-1", "user-2", 25, {
    type: "guess_reward", cooldownMs: 60_000, now: new Date(firstAt.getTime() + 60_000)
  });

  assert.equal(first.awarded, true);
  assert.equal(early.awarded, false);
  assert.equal(ready.awarded, true);
  assert.equal(ready.account.balance, 50);
  assert.equal(prisma.transactions.length, 2);
});

test("game reward rejects invalid cooldown values", async () => {
  const prisma = createPrisma();
  await assert.rejects(
    awardGameReward(prisma, "guild-1", "user-3", 25, { cooldownMs: 0 }),
    /Game reward cooldown must be a positive safe integer/
  );
});
