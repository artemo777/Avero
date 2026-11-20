import test from "node:test";
import assert from "node:assert/strict";
import { equipProfileBadge, unequipProfileBadge } from "../src/db/member-repository.js";

test("badge equip requires ownership and saves the selected item", async () => {
  let upsertArgs;
  let savedProfile = null;
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyPurchase: { findUnique: async ({ where }) => where.guildId_userId_itemId.itemId === "neon_badge" ? { itemId: "neon_badge" } : null },
    memberProfile: {
      findUnique: async () => savedProfile,
      upsert: async (args) => { upsertArgs = args; savedProfile = { ...args.create, ...args.update }; return savedProfile; }
    }
  };
  assert.deepEqual(await equipProfileBadge(prisma, "guild-1", "user-1", "vault_badge"), { equipped: false, reason: "not_owned" });
  const result = await equipProfileBadge(prisma, "guild-1", "user-1", "neon_badge");
  assert.equal(result.equipped, true);
  assert.equal(result.profile.equippedBadgeItemId, "neon_badge");
  assert.equal(upsertArgs.update.equippedBadgeItemId, "neon_badge");
  assert.deepEqual(upsertArgs.update.profileShowcaseBadgeIds, ["neon_badge"]);
});

test("badge unequip clears the saved selection", async () => {
  let upsertArgs;
  const prisma = { memberProfile: { upsert: async (args) => { upsertArgs = args; return { equippedBadgeItemId: null }; } } };
  const result = await unequipProfileBadge(prisma, "guild-1", "user-1");
  assert.equal(result.unequipped, true);
  assert.equal(result.profile.equippedBadgeItemId, null);
  assert.equal(upsertArgs.update.equippedBadgeItemId, null);
});


test("equipping a badge adds it to the profile showcase without exceeding five", async () => {
  let savedProfile = { profileShowcaseBadgeIds: ["vault_badge", "starlight_badge", "avero_relic", "star_pin"] };
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyPurchase: { findUnique: async () => ({ itemId: "neon_badge" }) },
    memberProfile: {
      findUnique: async () => savedProfile,
      upsert: async (args) => { savedProfile = { ...savedProfile, ...args.create, ...args.update }; return savedProfile; }
    }
  };
  const added = await equipProfileBadge(prisma, "guild-1", "user-1", "neon_badge");
  assert.equal(added.equipped, true);
  assert.deepEqual(savedProfile.profileShowcaseBadgeIds, ["vault_badge", "starlight_badge", "avero_relic", "star_pin", "neon_badge"]);
  assert.deepEqual(await equipProfileBadge(prisma, "guild-1", "user-1", "another_badge"), { equipped: false, reason: "not_owned" });
});

test("badge removal removes only that badge from the profile showcase", async () => {
  let savedProfile = {
    equippedBadgeItemId: "neon_badge",
    profileShowcaseBadgeIds: ["vault_badge", "neon_badge", "star_pin"]
  };
  const prisma = {
    memberProfile: {
      findUnique: async () => savedProfile,
      upsert: async (args) => { savedProfile = { ...savedProfile, ...args.create, ...args.update }; return savedProfile; }
    }
  };
  const result = await unequipProfileBadge(prisma, "guild-1", "user-1", "neon_badge");
  assert.equal(result.unequipped, true);
  assert.deepEqual(savedProfile.profileShowcaseBadgeIds, ["vault_badge", "star_pin"]);
  assert.equal(savedProfile.equippedBadgeItemId, null);
});

test("badge equip refuses a sixth showcase badge", async () => {
  const savedProfile = { profileShowcaseBadgeIds: ["a", "b", "c", "d", "e"] };
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyPurchase: { findUnique: async () => ({ itemId: "sixth" }) },
    memberProfile: {
      findUnique: async () => savedProfile,
      upsert: async () => { throw new Error("must not save"); }
    }
  };
  assert.deepEqual(await equipProfileBadge(prisma, "guild-1", "user-1", "sixth"), { equipped: false, reason: "showcase_full" });
});
