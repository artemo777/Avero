import test from "node:test";
import assert from "node:assert/strict";
import { adjustAdminInventory, recordAdminXpGrant } from "../src/db/admin-economy-repository.js";

const guildId = "12345678901234567";
const userId = "22345678901234567";
const adminId = "32345678901234567";

function fakePrisma() {
  const purchases = new Map();
  const audits = [];
  const key = (x) => x.guildId + ":" + x.userId;
  const composite = (x) => key(x) + ":" + x.itemId;
  const tx = {
    currencyPurchase: {
      async findUnique({ where }) { return purchases.get(composite(where.guildId_userId_itemId)) ?? null; },
      async create({ data }) { purchases.set(composite(data), data); },
      async delete({ where }) { purchases.delete(composite(where.guildId_userId_itemId)); }
    },
    memberProfile: {
      profiles: new Map(),
      async findUnique() { return null; },
      async upsert({ where, create, update }) { const k = key(where.guildId_userId); const old = this.profiles.get(k); const value = old ? { ...old, xp: old.xp + update.xp.increment } : { ...create }; this.profiles.set(k, value); return { ...value }; },
      async update({ where, data }) { const k = key(where.guildId_userId); const value = { ...this.profiles.get(k), ...data }; this.profiles.set(k, value); return { ...value }; }
    },
    adminEconomyAudit: { async create({ data }) { audits.push(data); } }
  };
  return {
    $transaction: (fn) => fn(tx),
    purchases,
    audits,
    adminEconomyAudit: tx.adminEconomyAudit,
    tx
  };
}

test("admin inventory grants once and removes only owned items", async () => {
  const prisma = fakePrisma();
  assert.equal((await adjustAdminInventory(prisma, guildId, userId, adminId, "starter_badge", "grant")).updated, true);
  assert.equal((await adjustAdminInventory(prisma, guildId, userId, adminId, "starter_badge", "grant")).reason, "already_owned");
  assert.equal((await adjustAdminInventory(prisma, guildId, userId, adminId, "starter_badge", "remove")).updated, true);
  assert.equal((await adjustAdminInventory(prisma, guildId, userId, adminId, "starter_badge", "remove")).reason, "not_owned");
  assert.equal(prisma.audits.length, 2);
});

test("admin XP grants update Avero profile and audit the actor", async () => {
  const prisma = fakePrisma();
  const profile = await recordAdminXpGrant(prisma, guildId, userId, adminId, 500, "staff event");
  assert.equal(profile.xp, 500);
  assert.equal(prisma.audits[0].action, "xp_add");
  assert.equal(prisma.audits[0].actorUserId, adminId);
  await assert.rejects(recordAdminXpGrant(prisma, guildId, userId, adminId, 0), /Amount/);
});
