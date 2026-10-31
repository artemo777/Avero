import test from "node:test";
import assert from "node:assert/strict";
import { equipProfileBadge, unequipProfileBadge } from "../src/db/member-repository.js";

test("badge equip requires ownership and saves the selected item", async () => {
  let upsertArgs;
  const prisma = {
    currencyPurchase: { findUnique: async ({ where }) => where.guildId_userId_itemId.itemId === "neon_badge" ? { itemId: "neon_badge" } : null },
    memberProfile: { upsert: async (args) => { upsertArgs = args; return { ...args.create, ...args.update }; } }
  };
  assert.deepEqual(await equipProfileBadge(prisma, "guild-1", "user-1", "vault_badge"), { equipped: false, reason: "not_owned" });
  const result = await equipProfileBadge(prisma, "guild-1", "user-1", "neon_badge");
  assert.equal(result.equipped, true);
  assert.equal(result.profile.equippedBadgeItemId, "neon_badge");
  assert.equal(upsertArgs.update.equippedBadgeItemId, "neon_badge");
});

test("badge unequip clears the saved selection", async () => {
  let upsertArgs;
  const prisma = { memberProfile: { upsert: async (args) => { upsertArgs = args; return { equippedBadgeItemId: null }; } } };
  const result = await unequipProfileBadge(prisma, "guild-1", "user-1");
  assert.equal(result.unequipped, true);
  assert.equal(result.profile.equippedBadgeItemId, null);
  assert.equal(upsertArgs.update.equippedBadgeItemId, null);
});
