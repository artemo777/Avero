import test from "node:test";
import assert from "node:assert/strict";
import { claimWorkReward } from "../src/db/currency-repository.js";
import { workCommand } from "../src/bot/commands/work.js";
import { renderWorkJobsPage } from "../src/bot/game-ui.js";
import { WORK_JOBS } from "../src/bot/work-catalog.js";
import { MessageFlags } from "discord.js";

function createPrisma(initialBalance = 0) {
  const accounts = new Map();
  const transactions = [];
  const keyOf = (guildId, userId) => guildId + ":" + userId;
  const prisma = {
    accounts,
    transactions,
    $transaction: (callback) => callback(prisma),
    currencyAccount: {
      async upsert({ where, create }) {
        const key = keyOf(where.guildId_userId.guildId, where.guildId_userId.userId);
        if (!accounts.has(key)) accounts.set(key, { ...create, balance: initialBalance, lastDailyAt: null, lastWorkAt: null });
        return accounts.get(key);
      },
      async findUnique({ where }) {
        const key = keyOf(where.guildId_userId.guildId, where.guildId_userId.userId);
        const account = accounts.get(key);
        return account ? { ...account } : null;
      },
      async updateMany({ where, data }) {
        const key = keyOf(where.guildId, where.userId);
        const account = accounts.get(key);
        if (!account) return { count: 0 };
        const allowed = where.OR.some((condition) => {
          if (Object.hasOwn(condition, "lastWorkAt") && condition.lastWorkAt === null) {
            return account.lastWorkAt === null;
          }
          return Boolean(condition.lastWorkAt?.lte && account.lastWorkAt && account.lastWorkAt <= condition.lastWorkAt.lte);
        });
        if (!allowed) return { count: 0 };
        account.balance += data.balance.increment;
        account.lastWorkAt = data.lastWorkAt;
        return { count: 1 };
      }
    },
    currencyTransaction: {
      async create({ data }) {
        transactions.push({ ...data });
        return data;
      }
    }
  };
  return prisma;
}

test("work rewards atomically credit coins and record the shift", async () => {
  const prisma = createPrisma(10);
  const now = new Date("2026-10-28T12:00:00.000Z");
  const result = await claimWorkReward(prisma, "guild-1", "user-1", { amount: 95, now });

  assert.equal(result.claimed, true);
  assert.equal(result.amount, 95);
  assert.equal(result.account.balance, 105);
  assert.equal(result.account.lastWorkAt.getTime(), now.getTime());
  assert.deepEqual(prisma.transactions, [{
    guildId: "__avero_global__",
    userId: "user-1",
    amount: 95,
    type: "work",
    createdAt: now
  }]);
});

test("work cooldown blocks repeated claims without paying twice", async () => {
  const prisma = createPrisma(0);
  const now = new Date("2026-10-28T12:00:00.000Z");
  await claimWorkReward(prisma, "guild-1", "user-1", { amount: 80, now });
  const result = await claimWorkReward(prisma, "guild-1", "user-1", {
    amount: 100,
    now: new Date(now.getTime() + 60_000)
  });

  assert.equal(result.claimed, false);
  assert.equal(result.account.balance, 80);
  assert.equal(prisma.transactions.length, 1);
});

test("work validates reward, cooldown, and timestamps", async () => {
  const prisma = createPrisma();
  await assert.rejects(claimWorkReward(prisma, "g", "u", { amount: 0 }), /positive integer/);
  await assert.rejects(claimWorkReward(prisma, "g", "u", { cooldownMs: 0 }), /positive safe integer/);
  await assert.rejects(claimWorkReward(prisma, "g", "u", { now: new Date("invalid") }), /valid Date/);
});

test("work command responds privately outside servers and requires database context", async () => {
  const replies = [];
  const interaction = {
    guildId: null,
    user: { id: "user-1" },
    async reply(payload) { replies.push(payload); }
  };
  await workCommand.execute(interaction, { prisma: createPrisma() });
  assert.deepEqual(replies[0], {
    content: "Work is available inside a server.",
    flags: MessageFlags.Ephemeral
  });
  await assert.rejects(workCommand.execute({ ...interaction, guildId: "guild-1" }), /requires a database/);
});


test("work career board paginates at five jobs and uses the professor mascot", async () => {
  const first = await renderWorkJobsPage("user-1", 0);
  const firstJson = first.components[0].toJSON();
  const firstText = firstJson.components.filter((part) => part.type === 10).map((part) => part.content).join("\n");
  assert.equal(first.files.length, 1);
  assert.equal(firstJson.components.filter((part) => part.type === 9).length, 6);
  assert.match(firstText, new RegExp(WORK_JOBS[0].name));
  assert.match(firstText, new RegExp(WORK_JOBS[4].name));
  assert.doesNotMatch(firstText, new RegExp(WORK_JOBS[5].name));
  assert.match(firstText, /PAGE 1 OF 4/);
  const firstButtons = firstJson.components.filter((part) => part.type === 1).flatMap((row) => row.components);
  assert.ok(firstButtons.some((button) => button.custom_id === "avero|user-1|work_page|1"));
  assert.equal(firstJson.components.filter((part) => part.type === 9).at(-1).accessory.media.url, "attachment://avero-professor.png");
  const second = await renderWorkJobsPage("user-1", 1);
  const secondText = second.components[0].toJSON().components.filter((part) => part.type === 10).map((part) => part.content).join("\n");
  assert.match(secondText, new RegExp(WORK_JOBS[5].name));
  assert.match(secondText, /PAGE 2 OF 4/);
});
