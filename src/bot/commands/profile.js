import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder,
  MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, TextDisplayBuilder
} from "discord.js";
import { renderProfileCard, PROFILE_BANNERS } from "../../../averoui/profile-card.js";
import { getCurrencyAccount, getCurrencyPurchases, getCurrencyStats } from "../../db/currency-repository.js";
import { getMemberProfile } from "../../db/member-repository.js";
import { getMemberTitles } from "../../db/title-repository.js";
import { SHOP_ITEMS } from "../shop-catalog.js";
import { TITLE_CATALOG } from "../title-catalog.js";

export const PROFILE_ACCENTS = Object.freeze([
  0x8b7cff, 0x42d6c5, 0x65a9ff, 0xff9b70, 0xf078a8, 0xe5c45d, 0x9ba5b4, 0xffffff
]);
export const PROFILE_DECORATIONS = Object.freeze(["halo_ring", "orbit_spark", "pixel_wings"]);
export const PROFILE_FRAME_IDS = Object.freeze([
  "aurora_frame", "nebula_cape", "moonlit_token", "prism_crown", "pixel_cape",
  "cloud_specs", "comet_trail", "mossy_mug", "paper_crown"
]);

function profileButton(userId, action, label) {
  return new ButtonBuilder().setCustomId("avero|" + userId + "|" + action).setLabel(label).setStyle(ButtonStyle.Secondary);
}

export async function renderProfilePayload(prisma, guildId, target, viewerId = target.id, editable = target.id === viewerId) {
  const [account, purchases, profile, stats] = await Promise.all([
    getCurrencyAccount(prisma, guildId, target.id),
    getCurrencyPurchases(prisma, guildId, target.id),
    getMemberProfile(prisma, guildId, target.id),
    getCurrencyStats(prisma, guildId, target.id)
  ]);
  const owned = new Set(purchases.map((purchase) => purchase.itemId));
  const ownedItems = purchases.map((purchase) => SHOP_ITEMS.find((item) => item.id === purchase.itemId)).filter(Boolean);
  const equippedTitle = TITLE_CATALOG.find((entry) => entry.id === profile?.equippedTitleId);
  const equippedFrame = SHOP_ITEMS.find((item) => item.id === profile?.equippedFrameItemId && owned.has(item.id));
  const equippedDecoration = SHOP_ITEMS.find((item) => item.id === profile?.equippedAvatarDecorationId && owned.has(item.id));
  const ownedBadges = ownedItems.filter((item) => item.category === "badges");
  const selectedBadgeIds = Array.isArray(profile?.profileShowcaseBadgeIds) && profile.profileShowcaseBadgeIds.length
    ? profile.profileShowcaseBadgeIds
    : (profile?.equippedBadgeItemId ? [profile.equippedBadgeItemId] : []);
  const badges = selectedBadgeIds.map((id) => ownedBadges.find((item) => item.id === id)).filter(Boolean);
  const accent = profile?.profileAccentColor ?? PROFILE_ACCENTS[0];
  const banner = PROFILE_BANNERS.includes(profile?.profileBanner) ? profile.profileBanner : "midnight";
  const card = await renderProfileCard({
    username: target.globalName ?? target.username,
    avatarUrl: target.displayAvatarURL({ extension: "png", size: 256 }),
    level: profile?.level ?? 0,
    title: equippedTitle?.name ?? null,
    accentColor: accent,
    banner,
    frame: equippedFrame?.id ?? null,
    avatarDecoration: equippedDecoration?.id ?? null,
    badges,
    coins: account?.balance ?? 0,
    collectionCount: ownedItems.length
  });
  const container = new ContainerBuilder().setAccentColor(accent);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    "-# AVERO / PROFILE CANVAS\n## " + (target.globalName ?? target.username) + "\nA customizable snapshot of your Avero identity."
  ));
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL("attachment://profile-card.png").setDescription("Avero member profile card")
  ));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
    "**Title** · " + (equippedTitle?.name ?? "None"),
    "**Frame** · " + (equippedFrame?.name ?? "Default"),
    "**Avatar decoration** · " + (equippedDecoration?.name ?? "None"),
    "**Showcased badges** · " + (badges.length ? badges.map((item) => item.name).join(" · ") : "None"),
    "-# " + stats.gamesPlayed + " games played · " + (account?.dailyStreak ?? 0) + " day daily streak"
  ].join("\n")));
  if (editable) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
      profileButton(viewerId, "profile_accent", "Accent color"),
      profileButton(viewerId, "profile_banner", "Banner"),
      profileButton(viewerId, "profile_avatar", "Avatar deco"),
      profileButton(viewerId, "profile_frame", "Frame"),
      profileButton(viewerId, "profile_badges", "Badge showcase")
    ));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      "-# Customize your canvas here · Equip titles with /titles · Collect cosmetics in /shop"
    ));
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# AVERO • GLOBAL PROFILE"));
  }
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    files: [new AttachmentBuilder(card, { name: "profile-card.png" })],
    allowedMentions: { parse: [] }
  };
}

export const profileCommand = Object.freeze({
  data: Object.freeze({
    name: "profile",
    description: "View a customizable Avero profile card.",
    options: [{ type: 6, name: "member", description: "Member profile to view.", required: false }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Profile command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Profiles are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const target = interaction.options.getUser("member") ?? interaction.user;
    await interaction.reply(await renderProfilePayload(prisma, interaction.guildId, target, interaction.user.id, target.id === interaction.user.id));
  }
});
