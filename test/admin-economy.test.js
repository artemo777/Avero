import test from "node:test";
import assert from "node:assert/strict";
import { adjustAdminCurrency, adjustAdminInventory, recordAdminXpGrant } from "../src/db/admin-economy-repository.js";

const guildId = "12345678901234567";
const userId = "22345678901234567";
const adminId = "32345678901234567";

function fakePrisma() {
  const accounts = new Map();
  const purchases = new Map();
  const audits = [];
  const transactions = [];
  const key = (x) => x.guildId + ":" + x.userId;
  const composite = (x) => key(x) + ":" + x.itemId;
  const tx = {
    currencyAccount: {
      async upsert({ where, create }) {
        const k = key(where.guildId_userId);
        if (!accounts.has(k)) accounts.set(k, { ...create, balance: 0, gemBalance: 0 });
      },
      async findUnique({ where }) { return accounts.get(key(where.guildId_userId)) ?? null; },
      async update({ where, data }) { Object.assign(accounts.get(key(where.guildId_userId)), data); }
    },
    currencyPurchase: {
      async findUnique({ where }) { return purchases.get(composite(where.guildId_userId_itemId)) ?? null; },
      async create({ data }) { purchases.set(composite(data), data); },
      async delete({ where }) { purchases.delete(composite(where.guildId_userId_itemId)); }
    },
    currencyTransaction: { async create({ data }) { transactions.push(data); } },
    adminEconomyAudit: { async create({ data }) { audits.push(data); } }
  };
  return { $transaction: (fn) => fn(tx), accounts, purchases, audits, transactions, tx };
}

test("admin currency add, remove and set keep a signed ledger and audit record", async () => {
  const prisma = fakePrisma();
  const added = await adjustAdminCurrency(prisma, guildId, userId, adminId, "coins", "add", 250, "event prize");
  assert.equal(added.balance, 250);
  const removed = await adjustAdminCurrency(prisma, guildId, userId, adminId, "coins", "remove", 50);
  assert.equal(removed.balance, 200);
  const set = await adjustAdminCurrency(prisma, guildId, userId, adminId, "coins", "set", 0);
  assert.equal(set.balance, 0);
  assert.deepEqual(prisma.transactions.map((entry) => entry.amount), [250, -50, -200]);
  assert.equal(prisma.audits.length, 3);
});

test("admin currency cannot reduce a balance below zero", async () => {
  const prisma = fakePrisma();
  const result = await adjustAdminCurrency(prisma, guildId, userId, adminId, "gems", "remove", 1);
  assert.deepEqual(result, { updated: false, reason: "insufficient_balance", previous: 0, next: 0 });
  assert.equal(prisma.audits.length, 0);
});

test("admin inventory grants once and removes only owned items", async () => {
  const prisma = fakePrisma();
  assert.equal((await adjustAdminInventory(prisma, guildId, userId, adminId, "starter_badge", "grant")).updated, true);
  assert.equal((await adjustAdminInventory(prisma, guildId, userId, adminId, "starter_badge", "grant")).reason, "already_owned");
  assert.equal((await adjustAdminInventory(prisma, guildId, userId, adminId, "starter_badge", "remove")).updated, true);
  assert.equal((await adjustAdminInventory(prisma, guildId, userId, adminId, "starter_badge", "remove")).reason, "not_owned");
  assert.equal(prisma.audits.length, 2);
});

test("admin XP audit validates the amount and stores the actor", async () => {
  const prisma = fakePrisma();
  await recordAdminXpGrant(prisma, guildId, userId, adminId, 500, "staff event");
  assert.equal(prisma.audits[0].action, "xp_add");
  assert.equal(prisma.audits[0].actorUserId, adminId);
  await assert.rejects(recordAdminXpGrant(prisma, guildId, userId, adminId, 0), /Amount/);
});
