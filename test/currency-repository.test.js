import test from "node:test";
import assert from "node:assert/strict";
import { awardGameReward, claimDailyReward, getCurrencyAccount } from "../src/db/currency-repository.js";

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

test("parallel daily claims award coins only once", async () => {
  const prisma = createFakePrisma();
  const now = new Date("2026-10-28T12:00:00.000Z");

  const results = await Promise.all([
    claimDailyReward(prisma, "lightx", "user-concurrent-daily", { amount: 100, now }),
    claimDailyReward(prisma, "lightx", "user-concurrent-daily", { amount: 100, now })
  ]);

  assert.equal(results.filter((result) => result.claimed).length, 1);
  assert.equal((await getCurrencyAccount(prisma, "lightx", "user-concurrent-daily")).balance, 100);
  assert.equal(prisma.transactions.filter((transaction) => transaction.type === "daily").length, 1);
});

test("game rewards update the server-scoped balance and create a ledger entry", async () => {
  const prisma = createFakePrisma();
  const now = new Date("2026-10-28T12:00:00.000Z");

  const result = await awardGameReward(prisma, "lightx", "winner-1", 25, {
    type: "guess_win",
    now
  });

  assert.equal(result.awarded, true);
  assert.equal(result.amount, 25);
  assert.equal(result.account.balance, 25);
  assert.deepEqual(prisma.transactions, [{
    guildId: "lightx",
    userId: "winner-1",
    amount: 25,
    type: "guess_win",
    createdAt: now
  }]);

  const otherServer = await getCurrencyAccount(prisma, "test-server", "winner-1");
  assert.equal(otherServer, null);
});

test("game reward rejects invalid amounts and ledger types", async () => {
  const prisma = createFakePrisma();
  await assert.rejects(awardGameReward(prisma, "lightx", "winner-2", 0), /Game reward/);
  await assert.rejects(awardGameReward(prisma, "lightx", "winner-2", 10, { type: "Bad Type" }), /lowercase identifier/);
});


test("daily reward is available exactly at the cooldown boundary", async () => {
  const prisma = createFakePrisma();
  const firstAt = new Date("2026-10-27T12:00:00.000Z");
  const nextAt = new Date(firstAt.getTime() + 86_400_000);

  const first = await claimDailyReward(prisma, "lightx", "boundary-user", { now: firstAt });
  const tooEarly = await claimDailyReward(prisma, "lightx", "boundary-user", {
    now: new Date(nextAt.getTime() - 1)
  });
  const atBoundary = await claimDailyReward(prisma, "lightx", "boundary-user", { now: nextAt });

  assert.equal(first.claimed, true);
  assert.equal(tooEarly.claimed, false);
  assert.equal(atBoundary.claimed, true);
  assert.equal(atBoundary.account.balance, 200);
  assert.equal(prisma.transactions.filter((transaction) => transaction.type === "daily").length, 2);
});

test("currency repository rejects invalid identifiers, cooldowns, and dates", async () => {
  const prisma = createFakePrisma();
  await assert.rejects(getCurrencyAccount(prisma, "", "user"), /guildId/);
  await assert.rejects(claimDailyReward(prisma, "guild", "user", { amount: 0 }), /Daily reward amount/);
  await assert.rejects(claimDailyReward(prisma, "guild", "user", { cooldownMs: 0 }), /Daily cooldown/);
  await assert.rejects(
    claimDailyReward(prisma, "guild", "user", { now: new Date("invalid") }),
    /valid Date/
  );
  assert.equal(prisma.transactions.length, 0);
});
