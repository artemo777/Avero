import test from "node:test";
import assert from "node:assert/strict";
import { equipProfileFrame, unequipProfileFrame } from "../src/db/member-repository.js";

test("profile frame equip requires ownership and persists the global selection", async () => {
  let upsertArgs;
  const prisma = {
    currencyPurchase: { findUnique: async ({ where }) => where.guildId_userId_itemId.itemId === "aurora_frame" ? { itemId: "aurora_frame" } : null },
    memberProfile: { upsert: async (args) => { upsertArgs = args; return { ...args.create, ...args.update }; } }
  };
  assert.deepEqual(await equipProfileFrame(prisma, "guild-1", "user-1", "nebula_cape"), { equipped: false, reason: "not_owned" });
  const result = await equipProfileFrame(prisma, "guild-1", "user-1", "aurora_frame");
  assert.equal(result.equipped, true);
  assert.equal(result.profile.equippedFrameItemId, "aurora_frame");
  assert.equal(upsertArgs.update.equippedFrameItemId, "aurora_frame");
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
