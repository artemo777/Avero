import test from "node:test";
import assert from "node:assert/strict";
import { adjustAdminInventory } from "../src/db/admin-economy-repository.js";

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
    memberProfile: { async findUnique() { return null; } },
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
