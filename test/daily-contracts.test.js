import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { claimDailyContract, getDailyContracts } from "../src/db/currency-repository.js";
import { contractsCommand } from "../src/bot/commands/contracts.js";

function createPrisma({ activity = {}, claimed = false, balance = 0 } = {}) {
  const claims = [];
  const transactions = [];
  const account = { guildId: "guild-1", userId: "user-1", balance };
  const prisma = {
    claims,
    transactions,
    $transaction: (callback) => callback(prisma),
    currencyTransaction: {
      async groupBy(query) {
        assert.equal(query.where.guildId, "guild-1");
        assert.equal(query.where.userId, "user-1");
        assert.ok(query.where.createdAt.gte instanceof Date);
        assert.ok(query.where.createdAt.lt instanceof Date);
        return Object.entries(activity).map(([type, count]) => ({
          type,
          _count: { _all: count }
        }));
      },
      async create({ data }) {
        transactions.push(data);
        return data;
      }
    },
    dailyContractClaim: {
      async findMany() {
        return claimed ? [{ contractId: "work_shift" }] : claims;
      },
      async findUnique() {
        return claimed || claims.length ? { contractId: "work_shift" } : null;
      },
      async create({ data }) {
        if (claimed || claims.some((claim) => claim.contractId === data.contractId)) {
          const error = new Error("Unique constraint");
          error.code = "P2002";
          throw error;
        }
        claims.push(data);
        return data;
      }
    },
    currencyAccount: {
      async upsert() { return account; },
      async updateMany({ data }) {
        account.balance += data.balance.increment;
        return { count: 1 };
      },
      async findUnique() { return { ...account }; }
    }
  };
  return prisma;
}

test("daily contracts derive progress from today's server-member transaction ledger", async () => {
  const prisma = createPrisma({
    activity: { work: 1, scavenge: 2, rps_win: 1, guess_loss: 1, vault_win: 1, shop_purchase: 1 }
  });
  const snapshot = await getDailyContracts(prisma, "guild-1", "user-1", {
    now: new Date("2026-10-30T23:59:00.000Z")
  });

  assert.equal(snapshot.date, "2026-10-30");
  assert.deepEqual(snapshot.contracts.map((contract) => contract.progress), [1, 2, 3, 1]);
  assert.deepEqual(snapshot.contracts.map((contract) => contract.complete), [false, false, true, true]);
});

test("daily contracts count only activity in the UTC day", async () => {
  const prisma = createPrisma({ activity: { work: 2 } });
  const snapshot = await getDailyContracts(prisma, "guild-1", "user-1", {
    now: new Date("2026-10-31T00:00:00.000Z")
  });
  assert.equal(snapshot.date, "2026-10-31");
  assert.equal(snapshot.contracts[0].progress, 2);
});

test("completed daily contract pays once and records a reward transaction", async () => {
  const prisma = createPrisma({ activity: { work: 2 }, balance: 15 });
  const now = new Date("2026-10-30T12:00:00.000Z");
  const result = await claimDailyContract(prisma, "guild-1", "user-1", "work_shift", { now });

  assert.equal(result.claimed, true);
  assert.equal(result.amount, 80);
  assert.equal(result.account.balance, 95);
  assert.equal(prisma.claims.length, 1);
  assert.deepEqual(prisma.transactions, [{
    guildId: "guild-1",
    userId: "user-1",
    amount: 80,
    type: "contract_reward",
    createdAt: now
  }]);
});

test("incomplete daily contract cannot be claimed", async () => {
  const prisma = createPrisma({ activity: { work: 1 }, balance: 15 });
  const result = await claimDailyContract(prisma, "guild-1", "user-1", "work_shift");
  assert.deepEqual(result, { claimed: false, reason: "incomplete", progress: 1, target: 2 });
  assert.equal(prisma.claims.length, 0);
  assert.equal(prisma.transactions.length, 0);
});

test("repeated daily contract claims return already claimed without paying again", async () => {
  const prisma = createPrisma({ activity: { work: 2 }, claimed: true, balance: 95 });
  const result = await claimDailyContract(prisma, "guild-1", "user-1", "work_shift");
  assert.equal(result.claimed, false);
  assert.equal(result.reason, "already_claimed");
  assert.equal(result.account.balance, 95);
  assert.equal(prisma.transactions.length, 0);
});

test("daily contracts reject invalid identifiers and timestamps", async () => {
  const prisma = createPrisma();
  await assert.rejects(claimDailyContract(prisma, "guild-1", "user-1", "not-real"), /Unknown daily contract/);
  await assert.rejects(getDailyContracts(prisma, "guild-1", "user-1", { now: new Date("invalid") }), /valid Date/);
});

test("contracts command responds privately outside servers", async () => {
  const replies = [];
  await contractsCommand.execute({
    guildId: null,
    user: { id: "user-1" },
    options: { getString: () => null },
    reply: async (payload) => replies.push(payload)
  }, { prisma: createPrisma() });

  assert.deepEqual(replies[0], {
    content: "Daily Contracts are available inside a server.",
    flags: MessageFlags.Ephemeral
  });
});
