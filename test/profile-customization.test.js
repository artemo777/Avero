import test from "node:test";
import assert from "node:assert/strict";
import { updateProfileCustomization } from "../src/db/member-repository.js";
import { renderProfileCard, PROFILE_BANNERS } from "../averoui/profile-card.js";

test("profile canvas customization persists the supported visual settings", async () => {
  let saved;
  const prisma = {
    currencyPurchase: { findUnique: async ({ where }) => ({ itemId: where.guildId_userId_itemId.itemId }) },
    memberProfile: { upsert: async (args) => { saved = args; return { ...args.create, ...args.update }; } }
  };
  const result = await updateProfileCustomization(prisma, "guild-1", "user-1", {
    profileAccentColor: 0x42d6c5,
    profileBanner: "aurora",
    profileBio: "A little about me",
    equippedAvatarDecorationId: "halo_ring",
    profileShowcaseBadgeIds: ["neon_badge", "vault_badge"]
  });
  assert.equal(result.updated, true);
  assert.equal(saved.update.profileAccentColor, 0x42d6c5);
  assert.equal(saved.update.profileBanner, "aurora");
  assert.equal(saved.update.profileBio, "A little about me");
  assert.equal(saved.update.equippedAvatarDecorationId, "halo_ring");
  assert.deepEqual(saved.update.profileShowcaseBadgeIds, ["neon_badge", "vault_badge"]);
});

test("profile customization requires ownership of avatar decorations and showcase badges", async () => {
  const prisma = {
    currencyPurchase: { findUnique: async () => null },
    memberProfile: { upsert: async () => { throw new Error("must not save"); } }
  };
  assert.deepEqual(
    await updateProfileCustomization(prisma, "guild-1", "user-1", { equippedAvatarDecorationId: "halo_ring" }),
    { updated: false, reason: "not_owned" }
  );
  assert.deepEqual(
    await updateProfileCustomization(prisma, "guild-1", "user-1", { profileShowcaseBadgeIds: ["neon_badge"] }),
    { updated: false, reason: "not_owned" }
  );
});

test("profile customization rejects unsupported colors, banners, and oversized bios", async () => {
  const prisma = { memberProfile: { upsert: async () => ({}) } };
  await assert.rejects(updateProfileCustomization(prisma, "g", "u", { profileAccentColor: 0x123456 }), /accent color/i);
  await assert.rejects(updateProfileCustomization(prisma, "g", "u", { profileBanner: "unknown" }), /banner/i);
  await assert.rejects(updateProfileCustomization(prisma, "g", "u", { profileBio: "x".repeat(121) }), /120 characters/i);
});

test("profile card renderer returns a PNG and exposes the supported banner presets", async () => {
  const png = await renderProfileCard({ username: "Avero Tester", banner: "aurora", badges: [{ name: "Glitch Gremlin", icon: "👾" }] });
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.ok(png.length > 1000);
  assert.deepEqual(PROFILE_BANNERS, ["midnight", "aurora", "sunset", "forest", "ocean", "graphite"]);
});
