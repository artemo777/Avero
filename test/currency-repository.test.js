import test from "node:test";
import assert from "node:assert/strict";
import { claimDailyReward, getCurrencyAccount, playCoinflip } from "../src/db/currency-repository.js";

function createFakePrisma() {
  const accounts = new Map();
  const transactions = [];
  const keyOf = ({ guildId, userId }) => guildId + ":" + userId;
  const prisma = {
    accounts,
    transactions,
    $transaction: (callback) => callback(prisma),
    currencyAccount: {
      async upsert({ where, create }) {
        const key = keyOf(where.guildId_userId);
        if (!accounts.has(key)) accounts.set(key, { ...create, balance: 0, lastDailyAt: null });
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
          const eligible = where.OR.some((condition) => {
            if (condition.lastDailyAt === null) return account.lastDailyAt === null;
            return account.lastDailyAt instanceof Date &&
              account.lastDailyAt <= condition.lastDailyAt.lte;
          });
          if (!eligible) return { count: 0 };
        }
        if (data.balance?.increment !== undefined) account.balance += data.balance.increment;
        if (data.lastDailyAt !== undefined) account.lastDailyAt = data.lastDailyAt;
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

test("daily reward is granted once per cooldown and scoped to each server", async () => {
  const prisma = createFakePrisma();
  const now = new Date("2026-10-28T12:00:00.000Z");

  const first = await claimDailyReward(prisma, "lightx", "user-1", { amount: 100, now });
  assert.equal(first.claimed, true);
  assert.equal(first.account.balance, 100);

  const second = await claimDailyReward(prisma, "lightx", "user-1", { amount: 100, now });
  assert.equal(second.claimed, false);
  assert.equal(second.account.balance, 100);

  const otherServer = await claimDailyReward(prisma, "test-server", "user-1", { amount: 100, now });
  assert.equal(otherServer.claimed, true);
  assert.equal(otherServer.account.balance, 100);
  assert.equal(prisma.transactions.length, 2);
});

test("coinflip cannot spend more than the available balance", async () => {
  const prisma = createFakePrisma();
  const now = new Date("2026-10-28T12:00:00.000Z");
  await claimDailyReward(prisma, "lightx", "user-2", { amount: 100, now });

  const loss = await playCoinflip(prisma, "lightx", "user-2", 60, false, { now });
  assert.equal(loss.played, true);
  assert.equal(loss.account.balance, 40);

  const tooLarge = await playCoinflip(prisma, "lightx", "user-2", 41, false, { now });
  assert.equal(tooLarge.played, false);
  assert.equal(tooLarge.account.balance, 40);

  const account = await getCurrencyAccount(prisma, "lightx", "user-2");
  assert.equal(account.balance, 40);
  assert.equal(prisma.transactions.length, 2);
});

test("currency repository rejects invalid wagers and rewards", async () => {
  const prisma = createFakePrisma();
  await assert.rejects(claimDailyReward(prisma, "lightx", "user-3", { amount: 0 }), /Daily reward amount/);
  await assert.rejects(playCoinflip(prisma, "lightx", "user-3", 0, true), /Wager/);
});
