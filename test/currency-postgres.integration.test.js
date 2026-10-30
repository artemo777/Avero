import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  awardGameReward, claimDailyContract, claimDailyReward, purchaseCurrencyItem, submitDailyVaultAttempt
} from "../src/db/currency-repository.js";

const enabled = Boolean(process.env.DATABASE_URL);
const prisma = enabled ? new PrismaClient() : null;

after(async () => {
  if (prisma) await prisma.$disconnect();
});

async function createAccount(balance = 0) {
  const guildId = "integration-" + randomUUID();
  const userId = "user-" + randomUUID();
  await prisma.currencyAccount.create({ data: { guildId, userId, balance } });
  return { guildId, userId };
}

async function cleanGuild(guildId) {
  await prisma.dailyContractClaim.deleteMany({ where: { guildId } });
  await prisma.currencyTransaction.deleteMany({ where: { guildId } });
  await prisma.currencyPurchase.deleteMany({ where: { guildId } });
  await prisma.currencyAccount.deleteMany({ where: { guildId } });
}

test("PostgreSQL allows only one concurrent daily claim", { skip: !enabled }, async (t) => {
  const { guildId, userId } = await createAccount();
  t.after(() => cleanGuild(guildId));
  const now = new Date("2026-10-30T12:00:00.000Z");

  const results = await Promise.all([
    claimDailyReward(prisma, guildId, userId, { amount: 100, now }),
    claimDailyReward(prisma, guildId, userId, { amount: 100, now })
  ]);

  assert.equal(results.filter((result) => result.claimed).length, 1);
  const account = await prisma.currencyAccount.findUnique({
    where: { guildId_userId: { guildId, userId } }
  });
  assert.equal(account.balance, 100);
  assert.equal(await prisma.currencyTransaction.count({ where: { guildId, userId, type: "daily" } }), 1);
});

test("PostgreSQL prevents concurrent different-item purchases from overspending", { skip: !enabled }, async (t) => {
  const { guildId, userId } = await createAccount(300);
  t.after(() => cleanGuild(guildId));

  const results = await Promise.all([
    purchaseCurrencyItem(prisma, guildId, userId, "neon_badge", 150),
    purchaseCurrencyItem(prisma, guildId, userId, "vault_badge", 300)
  ]);
  const winner = results.find((result) => result.purchased);

  assert.ok(winner);
  assert.equal(results.filter((result) => result.purchased).length, 1);
  const account = await prisma.currencyAccount.findUnique({
    where: { guildId_userId: { guildId, userId } }
  });
  assert.equal(account.balance, 300 - winner.price);
  assert.equal(await prisma.currencyPurchase.count({ where: { guildId, userId } }), 1);
  assert.equal(await prisma.currencyTransaction.count({ where: { guildId, userId, type: "shop_purchase" } }), 1);
});

test("PostgreSQL rolls back a duplicate concurrent purchase without double charging", { skip: !enabled }, async (t) => {
  const { guildId, userId } = await createAccount(500);
  t.after(() => cleanGuild(guildId));

  const results = await Promise.all([
    purchaseCurrencyItem(prisma, guildId, userId, "neon_badge", 150),
    purchaseCurrencyItem(prisma, guildId, userId, "neon_badge", 150)
  ]);

  assert.equal(results.filter((result) => result.purchased).length, 1);
  assert.equal(results.filter((result) => result.reason === "owned").length, 1);
  const account = await prisma.currencyAccount.findUnique({
    where: { guildId_userId: { guildId, userId } }
  });
  assert.equal(account.balance, 350);
  assert.equal(await prisma.currencyPurchase.count({ where: { guildId, userId, itemId: "neon_badge" } }), 1);
  assert.equal(await prisma.currencyTransaction.count({ where: { guildId, userId, type: "shop_purchase" } }), 1);
});

test("PostgreSQL awards a concurrent game reward only once inside its cooldown", { skip: !enabled }, async (t) => {
  const { guildId, userId } = await createAccount();
  t.after(() => cleanGuild(guildId));
  const now = new Date("2026-10-30T13:00:00.000Z");

  const results = await Promise.all([
    awardGameReward(prisma, guildId, userId, 25, { type: "guess_reward", cooldownMs: 600_000, now }),
    awardGameReward(prisma, guildId, userId, 25, { type: "guess_reward", cooldownMs: 600_000, now })
  ]);

  assert.equal(results.filter((result) => result.awarded).length, 1);
  assert.equal(results.filter((result) => result.reason === "cooldown").length, 1);
  const account = await prisma.currencyAccount.findUnique({
    where: { guildId_userId: { guildId, userId } }
  });
  assert.equal(account.balance, 25);
  assert.equal(await prisma.currencyTransaction.count({ where: { guildId, userId, type: "guess_reward" } }), 1);
});


test("PostgreSQL records only one Vault submission per member and UTC day", { skip: !enabled }, async (t) => {
  const { guildId, userId } = await createAccount();
  t.after(() => cleanGuild(guildId));
  const now = new Date("2026-10-30T18:00:00.000Z");

  const results = await Promise.all([
    submitDailyVaultAttempt(prisma, guildId, userId, "win", 25, { cooldownMs: 600_000, now }),
    submitDailyVaultAttempt(prisma, guildId, userId, "win", 25, { cooldownMs: 600_000, now })
  ]);

  assert.equal(results.filter((result) => result.submitted).length, 1);
  assert.equal(results.filter((result) => result.reason === "already_played").length, 1);
  assert.equal(await prisma.dailyContractClaim.count({
    where: { guildId, userId, contractDate: "2026-10-30", contractId: "vault_attempt" }
  }), 1);
  assert.equal(await prisma.currencyTransaction.count({
    where: { guildId, userId, type: { in: ["vault_win", "vault_loss"] } }
  }), 1);
  assert.equal(await prisma.dailyContractClaim.count({
    where: { guildId, userId, contractDate: "2026-10-30", contractId: "vault_reward" }
  }), 1);
  assert.equal(await prisma.currencyTransaction.count({
    where: { guildId, userId, type: "vault_reward" }
  }), 1);

  const retry = await submitDailyVaultAttempt(prisma, guildId, userId, "win", 25, {
    cooldownMs: 600_000,
    now: new Date(now.getTime() + 11 * 60_000)
  });
  assert.equal(retry.submitted, false);
  assert.equal(retry.reason, "already_played");

  const account = await prisma.currencyAccount.findUnique({
    where: { guildId_userId: { guildId, userId } }
  });
  assert.equal(account.balance, 25);
});

test("PostgreSQL allows only one concurrent claim for a completed daily contract", { skip: !enabled }, async (t) => {
  const { guildId, userId } = await createAccount(10);
  t.after(() => cleanGuild(guildId));
  const now = new Date("2026-10-30T15:00:00.000Z");
  await prisma.currencyTransaction.createMany({
    data: [
      { guildId, userId, amount: 80, type: "work", createdAt: now },
      { guildId, userId, amount: 90, type: "work", createdAt: now }
    ]
  });

  const results = await Promise.all([
    claimDailyContract(prisma, guildId, userId, "work_shift", { now }),
    claimDailyContract(prisma, guildId, userId, "work_shift", { now })
  ]);

  assert.equal(results.filter((result) => result.claimed).length, 1);
  assert.equal(results.filter((result) => result.reason === "already_claimed").length, 1);
  const account = await prisma.currencyAccount.findUnique({
    where: { guildId_userId: { guildId, userId } }
  });
  assert.equal(account.balance, 90);
  assert.equal(await prisma.dailyContractClaim.count({ where: { guildId, userId, contractDate: "2026-10-30", contractId: "work_shift" } }), 1);
  assert.equal(await prisma.currencyTransaction.count({ where: { guildId, userId, type: "contract_reward" } }), 1);
});
