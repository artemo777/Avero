import test from "node:test";
import assert from "node:assert/strict";
import { equipProfileBadge, unequipProfileBadge } from "../src/db/member-repository.js";
import { renderItemDetails } from "../src/bot/game-ui.js";

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

test("badge equip rejects owned collectibles outside the showcase badge catalog", async () => {
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyPurchase: { findUnique: async () => ({ itemId: "aurora_frame" }) },
    memberProfile: {
      findUnique: async () => null,
      upsert: async () => { throw new Error("must not save a non-badge"); }
    }
  };
  await assert.rejects(
    equipProfileBadge(prisma, "guild-1", "user-1", "aurora_frame"),
    /cannot be showcased as a badge/
  );
});

test("badge unequip clears the saved selection", async () => {
  let upsertArgs;
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    memberProfile: {
      findUnique: async () => ({ equippedBadgeItemId: "neon_badge", profileShowcaseBadgeIds: ["neon_badge"] }),
      upsert: async (args) => { upsertArgs = args; return { equippedBadgeItemId: null, profileShowcaseBadgeIds: [] }; }
    }
  };
  const result = await unequipProfileBadge(prisma, "guild-1", "user-1");
  assert.equal(result.unequipped, true);
  assert.equal(result.profile.equippedBadgeItemId, null);
  assert.equal(upsertArgs.update.equippedBadgeItemId, null);
});


test("equipping a badge adds it to the profile showcase without exceeding five", async () => {
  let savedProfile = { profileShowcaseBadgeIds: ["vault_badge", "starlight_badge", "avero_relic", "star_pin"] };
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyPurchase: { findUnique: async ({ where }) => where.guildId_userId_itemId.itemId === "neon_badge" ? { itemId: "neon_badge" } : null },
    memberProfile: {
      findUnique: async () => savedProfile,
      upsert: async (args) => { savedProfile = { ...savedProfile, ...args.create, ...args.update }; return savedProfile; }
    }
  };
  const added = await equipProfileBadge(prisma, "guild-1", "user-1", "neon_badge");
  assert.equal(added.equipped, true);
  assert.deepEqual(savedProfile.profileShowcaseBadgeIds, ["vault_badge", "starlight_badge", "avero_relic", "star_pin", "neon_badge"]);
  assert.deepEqual(await equipProfileBadge(prisma, "guild-1", "user-1", "crystal_badge"), { equipped: false, reason: "not_owned" });
});

test("badge removal removes only that badge from the profile showcase", async () => {
  let savedProfile = {
    equippedBadgeItemId: "neon_badge",
    profileShowcaseBadgeIds: ["vault_badge", "neon_badge", "star_pin"]
  };
  const prisma = {
    $transaction: async (callback) => callback(prisma),
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
  const savedProfile = { profileShowcaseBadgeIds: ["neon_badge", "vault_badge", "starlight_badge", "avero_relic", "star_pin"] };
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyPurchase: { findUnique: async () => ({ itemId: "tiny_trophy" }) },
    memberProfile: {
      findUnique: async () => savedProfile,
      upsert: async () => { throw new Error("must not save"); }
    }
  };
  assert.deepEqual(await equipProfileBadge(prisma, "guild-1", "user-1", "tiny_trophy"), { equipped: false, reason: "showcase_full" });
});


test("item details reflects the profile showcase badge list", async () => {
  const makePrisma = (showcase) => ({
    currencyPurchase: {
      findMany: async () => [{ itemId: "neon_badge" }]
    },
    currencyAccount: {
      findUnique: async () => ({ balance: 100, gemBalance: 0 })
    },
    memberProfile: {
      findUnique: async () => ({ profileShowcaseBadgeIds: showcase })
    }
  });
  const equipped = await renderItemDetails(makePrisma(["neon_badge"]), "guild-1", "user-1", "neon_badge");
  const equippedButtons = equipped.components[0].toJSON().components
    .filter((component) => component.type === 1)
    .flatMap((row) => row.components.map((button) => button.custom_id));
  assert.ok(equippedButtons.includes("avero|user-1|unequip_badge|neon_badge"));

  const notEquipped = await renderItemDetails(makePrisma([]), "guild-1", "user-1", "neon_badge");
  const availableButtons = notEquipped.components[0].toJSON().components
    .filter((component) => component.type === 1)
    .flatMap((row) => row.components.map((button) => button.custom_id));
  assert.ok(availableButtons.includes("avero|user-1|equip_badge|neon_badge"));
});


test("legacy equipped badge survives an empty showcase array when adding another badge", async () => {
  let savedProfile = { equippedBadgeItemId: "vault_badge", profileShowcaseBadgeIds: [] };
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyPurchase: { findUnique: async () => ({ itemId: "neon_badge" }) },
    memberProfile: {
      findUnique: async () => savedProfile,
      upsert: async (args) => { savedProfile = { ...savedProfile, ...args.create, ...args.update }; return savedProfile; }
    }
  };
  const result = await equipProfileBadge(prisma, "guild-1", "user-1", "neon_badge");
  assert.equal(result.equipped, true);
  assert.deepEqual(savedProfile.profileShowcaseBadgeIds, ["vault_badge", "neon_badge"]);
});

test("legacy equipped badge can be removed when the showcase array is empty", async () => {
  let savedProfile = { equippedBadgeItemId: "neon_badge", profileShowcaseBadgeIds: [] };
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    memberProfile: {
      findUnique: async () => savedProfile,
      upsert: async (args) => { savedProfile = { ...savedProfile, ...args.create, ...args.update }; return savedProfile; }
    }
  };
  await unequipProfileBadge(prisma, "guild-1", "user-1", "neon_badge");
  assert.equal(savedProfile.equippedBadgeItemId, null);
  assert.deepEqual(savedProfile.profileShowcaseBadgeIds, []);
});

test("item details falls back to a legacy equipped badge when the showcase array is empty", async () => {
  const prisma = {
    currencyPurchase: { findMany: async () => [{ itemId: "neon_badge" }] },
    currencyAccount: { findUnique: async () => ({ balance: 100, gemBalance: 0 }) },
    memberProfile: { findUnique: async () => ({ equippedBadgeItemId: "neon_badge", profileShowcaseBadgeIds: [] }) }
  };
  const response = await renderItemDetails(prisma, "guild-1", "user-1", "neon_badge");
  const text = response.components[0].toJSON().components
    .filter((component) => component.type === 10)
    .map((component) => component.content).join("\\n");
  assert.match(text, /Equipped badge/);
  const ids = response.components[0].toJSON().components
    .filter((component) => component.type === 1)
    .flatMap((row) => row.components.map((button) => button.custom_id));
  assert.ok(ids.includes("avero|user-1|unequip_badge|neon_badge"));
});


test("badge removal clears a stale legacy pointer outside the showcase", async () => {
  let savedProfile = { equippedBadgeItemId: "neon_badge", profileShowcaseBadgeIds: ["vault_badge"] };
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    memberProfile: {
      findUnique: async () => savedProfile,
      upsert: async (args) => { savedProfile = { ...savedProfile, ...args.create, ...args.update }; return savedProfile; }
    }
  };
  await unequipProfileBadge(prisma, "guild-1", "user-1", "vault_badge");
  assert.deepEqual(savedProfile.profileShowcaseBadgeIds, []);
  assert.equal(savedProfile.equippedBadgeItemId, null);
});
