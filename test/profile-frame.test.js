import test from "node:test";
import assert from "node:assert/strict";
import { equipProfileFrame, unequipProfileFrame } from "../src/db/member-repository.js";
import { PROFILE_FRAME_IDS } from "../src/bot/commands/profile.js";
import { SHOP_ITEMS } from "../src/bot/shop-catalog.js";

test("profile frame equip requires ownership and persists the global selection", async () => {
  let upsertArgs;
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyPurchase: { findUnique: async ({ where }) => ["aurora_frame", "chibi_frame"].includes(where.guildId_userId_itemId.itemId) ? { itemId: where.guildId_userId_itemId.itemId } : null },
    memberProfile: { upsert: async (args) => { upsertArgs = args; return { ...args.create, ...args.update }; } }
  };
  assert.deepEqual(await equipProfileFrame(prisma, "guild-1", "user-1", "nebula_cape"), { equipped: false, reason: "not_owned" });
  const result = await equipProfileFrame(prisma, "guild-1", "user-1", "aurora_frame");
  assert.equal(result.equipped, true);
  assert.equal(result.profile.equippedFrameItemId, "aurora_frame");
  assert.equal(upsertArgs.update.equippedFrameItemId, "aurora_frame");
  const chibi = await equipProfileFrame(prisma, "guild-1", "user-1", "chibi_frame");
  assert.equal(chibi.equipped, true);
  assert.equal(chibi.profile.equippedFrameItemId, "chibi_frame");
});

test("profile frame rejects a non-frame collectible", async () => {
  const prisma = { currencyPurchase: { findUnique: async () => ({ itemId: "neon_badge" }) } };
  await assert.rejects(equipProfileFrame(prisma, "guild-1", "user-1", "neon_badge"), /cannot be used as a profile frame/i);
});

test("profile frame unequip clears the selected frame", async () => {
  let upsertArgs;
  const prisma = { memberProfile: { upsert: async (args) => { upsertArgs = args; return { equippedFrameItemId: null }; } } };
  const result = await unequipProfileFrame(prisma, "guild-1", "user-1");
  assert.equal(result.unequipped, true);
  assert.equal(result.profile.equippedFrameItemId, null);
  assert.equal(upsertArgs.update.equippedFrameItemId, null);
});


test("profile frame selector names stay aligned with the shop catalog", async () => {
  const { PROFILE_FRAME_NAMES } = await import("../src/bot/commands/profile.js");
  for (const id of PROFILE_FRAME_IDS) {
    const item = SHOP_ITEMS.find((entry) => entry.id === id);
    assert.ok(item, id + " must exist in the shop catalog");
    assert.equal(PROFILE_FRAME_NAMES.get(id), item.name, id + " selector label must match its shop name");
  }
});
