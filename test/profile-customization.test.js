import test from "node:test";
import assert from "node:assert/strict";
import { updateProfileCustomization } from "../src/db/member-repository.js";
import { renderProfileCard, PROFILE_BANNERS } from "../averoui/profile-card.js";
import { downloadProfileBanner } from "../src/bot/commands/profile.js";

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

test("custom profile banner bytes and MIME type are persisted together", async () => {
  let saved;
  const bytes = Buffer.from("valid-test-image");
  const prisma = {
    memberProfile: {
      upsert: async (args) => { saved = args.update; return args.update; }
    }
  };
  const result = await updateProfileCustomization(prisma, "guild-1", "user-1", {
    profileBannerImage: bytes,
    profileBannerImageType: "image/webp"
  });
  assert.equal(result.updated, true);
  assert.deepEqual(saved.profileBannerImage, bytes);
  assert.equal(saved.profileBannerImageType, "image/webp");
});

test("custom profile banner can be cleared when switching back to a preset", async () => {
  let saved;
  const prisma = { memberProfile: { upsert: async (args) => { saved = args.update; return args.update; } } };
  await updateProfileCustomization(prisma, "guild-1", "user-1", {
    profileBanner: "aurora",
    profileBannerImage: null,
    profileBannerImageType: null
  });
  assert.equal(saved.profileBanner, "aurora");
  assert.equal(saved.profileBannerImage, null);
  assert.equal(saved.profileBannerImageType, null);
});

test("custom banner uploads reject non-Discord hosts and unsupported formats", async () => {
  await assert.rejects(downloadProfileBanner({
    url: "https://example.com/banner.png", contentType: "image/png", size: 1000
  }), /uploaded directly to Discord/i);
  await assert.rejects(downloadProfileBanner({
    url: "https://cdn.discordapp.com/attachments/1/2/banner.gif", contentType: "image/gif", size: 1000
  }), /PNG, JPEG, or WebP/i);
});

test("profile card renderer accepts a custom uploaded banner image", async () => {
  const source = await renderProfileCard({ username: "Banner source" });
  const card = await renderProfileCard({ username: "Custom banner", bannerImage: source });
  assert.equal(card.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.ok(card.length > 1000);
});
