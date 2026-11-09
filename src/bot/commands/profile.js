import {
  ActionRowBuilder, AttachmentBuilder, ContainerBuilder, MediaGalleryBuilder,
  MediaGalleryItemBuilder, MessageFlags, ModalBuilder, SectionBuilder, StringSelectMenuBuilder,
  TextDisplayBuilder, TextInputBuilder, TextInputStyle, ThumbnailBuilder
} from "discord.js";
import { loadImage } from "@napi-rs/canvas";
import { renderRegisteredAsset } from "../../../averoui/render-asset.js";
import { renderProfileCard, PROFILE_BANNERS } from "../../../averoui/profile-card.js";
import { getCurrencyAccount, getCurrencyPurchases, getCurrencyStats } from "../../db/currency-repository.js";
import { getMemberProfile, updateProfileCustomization } from "../../db/member-repository.js";
import { getMemberTitles } from "../../db/title-repository.js";
import { SHOP_ITEMS } from "../shop-catalog.js";
import { TITLE_CATALOG } from "../title-catalog.js";

export const PROFILE_ACCENTS = Object.freeze([
  0x8b7cff, 0x42d6c5, 0x65a9ff, 0xff9b70, 0xf078a8, 0xe5c45d, 0x9ba5b4, 0xffffff
]);
export const PROFILE_DECORATIONS = Object.freeze(["halo_ring", "orbit_spark", "pixel_wings"]);
export const PROFILE_FRAME_IDS = Object.freeze([
  "aurora_frame", "nebula_cape", "moonlit_token", "prism_crown", "pixel_cape",
  "cloud_specs", "comet_trail", "mossy_mug", "paper_crown", "blueprint_frame",
  "mono_frame", "chibi_frame", "cobalt_frame", "frost_frame", "ember_frame", "starlight_frame"
]);
const ACCENT_LABELS = new Map([
  [0x8b7cff, "Violet"], [0x42d6c5, "Mint"], [0x65a9ff, "Sky"],
  [0xff9b70, "Coral"], [0xf078a8, "Rose"], [0xe5c45d, "Gold"],
  [0x9ba5b4, "Silver"], [0xffffff, "White"]
]);
const PROFILE_ACCENT_EMOJIS = new Map([
  [0x8b7cff, "🟣"], [0x42d6c5, "🟢"], [0x65a9ff, "🔵"],
  [0xff9b70, "🟠"], [0xf078a8, "🩷"], [0xe5c45d, "🟡"],
  [0x9ba5b4, "⚪"], [0xffffff, "⬜"]
]);
const PROFILE_DECORATION_NAMES = new Map([
  ["halo_ring", "Halo Ring"], ["orbit_spark", "Orbit Sparks"], ["pixel_wings", "Pixel Wings"]
]);
const PROFILE_FRAME_NAMES = new Map([
  ["aurora_frame", "Aurora Frame"], ["nebula_cape", "Nebula Cape"], ["moonlit_token", "Moonlit Token"],
  ["prism_crown", "Prism Crown"], ["pixel_cape", "Pixel Cape"], ["cloud_specs", "Cloud Specs"],
  ["comet_trail", "Comet Trail"], ["mossy_mug", "Mossy Mug"], ["paper_crown", "Paper Crown"],
  ["blueprint_frame", "Blueprint Frame"], ["mono_frame", "Mono Frame"], ["chibi_frame", "Professor Chibi Frame"],
  ["cobalt_frame", "Cobalt Orbit Frame"], ["frost_frame", "Frostline Frame"], ["ember_frame", "Ember Frame"], ["starlight_frame", "Starlight Frame"]
]);

function profileSelect(userId, action, placeholder, options, { minValues = 1, maxValues = 1, disabled = false } = {}) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("avero|" + userId + "|" + action)
      .setPlaceholder(placeholder)
      .setMinValues(minValues)
      .setMaxValues(maxValues)
      .setDisabled(disabled)
      .addOptions(options)
  );
}

function ownedBadgeOptions(ownedBadges, selectedIds) {
  if (!ownedBadges.length) {
    return [{ label: "No badges owned yet", value: "none", description: "Unlock badges in /shop to showcase them.", default: true }];
  }
  return ownedBadges.map((item) => ({
    label: item.name.slice(0, 100),
    value: item.id,
    description: item.description.slice(0, 100),
    emoji: { name: item.icon },
    default: selectedIds.includes(item.id)
  }));
}

export async function renderProfilePayload(prisma, guildId, target, viewerId = target.id, editable = target.id === viewerId) {
  const [account, purchases, profile, stats, memberTitles] = await Promise.all([
    getCurrencyAccount(prisma, guildId, target.id),
    getCurrencyPurchases(prisma, guildId, target.id),
    getMemberProfile(prisma, guildId, target.id),
    getCurrencyStats(prisma, guildId, target.id),
    getMemberTitles(prisma, guildId, target.id)
  ]);
  const owned = new Set(purchases.map((purchase) => purchase.itemId));
  const ownedItems = purchases.map((purchase) => SHOP_ITEMS.find((item) => item.id === purchase.itemId)).filter(Boolean);
  const equippedTitle = TITLE_CATALOG.find((entry) => entry.id === profile?.equippedTitleId && memberTitles.some((ownedTitle) => ownedTitle.titleId === entry.id));
  const equippedFrame = SHOP_ITEMS.find((item) => item.id === profile?.equippedFrameItemId && owned.has(item.id));
  const equippedDecoration = SHOP_ITEMS.find((item) => item.id === profile?.equippedAvatarDecorationId && owned.has(item.id));
  const ownedBadges = ownedItems.filter((item) => item.category === "badges");
  const selectedBadgeIds = Array.isArray(profile?.profileShowcaseBadgeIds)
    ? profile.profileShowcaseBadgeIds
    : (profile?.equippedBadgeItemId ? [profile.equippedBadgeItemId] : []);
  const badges = selectedBadgeIds.map((id) => ownedBadges.find((item) => item.id === id)).filter(Boolean);
  const accent = profile?.profileAccentColor ?? PROFILE_ACCENTS[0];
  const banner = PROFILE_BANNERS.includes(profile?.profileBanner) ? profile.profileBanner : "midnight";
  const card = await renderProfileCard({
    username: target.globalName ?? target.username,
    avatarUrl: target.displayAvatarURL({ extension: "png", size: 256 }),
    title: equippedTitle?.name ?? null,
    bio: profile?.profileBio ?? null,
    accentColor: accent,
    banner,
    bannerImage: profile?.profileBannerImage ?? null,
    frame: equippedFrame?.id ?? null,
    avatarDecoration: equippedDecoration?.id ?? null,
    badges,
    coins: account?.balance ?? 0,
    collectionCount: ownedItems.length
  });
  const professor = await renderRegisteredAsset("mascot-professor", 72);
  const container = new ContainerBuilder().setAccentColor(accent);
  container.addSectionComponents(new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      "-# AVERO / PROFILE CANVAS\n## " + (target.globalName ?? target.username) + "\nA customizable snapshot of your Avero identity."
    ))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL("attachment://avero-professor.png")));
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL("attachment://profile-card.png").setDescription("Avero member profile card")
  ));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
    "**Title** · " + (equippedTitle?.name ?? "None"),
    "**Frame** · " + (equippedFrame?.name ?? "Default"),
    "**Avatar decoration** · " + (equippedDecoration?.name ?? "None"),
    "**Accent** · " + (ACCENT_LABELS.get(accent) ?? "Custom"),
    "**Banner** · " + (profile?.profileBannerImage ? "Custom upload" : banner[0].toUpperCase() + banner.slice(1)),
    "**Showcased badges** · " + (badges.length ? badges.map((item) => item.name).join(" · ") : "None"),
    "-# " + stats.gamesPlayed + " games played · " + (account?.dailyStreak ?? 0) + " day daily streak"
  ].join("\n")));

  if (editable) {
    const accentOptions = PROFILE_ACCENTS.map((color) => ({
      label: ACCENT_LABELS.get(color),
      value: String(color),
      emoji: { name: PROFILE_ACCENT_EMOJIS.get(color) },
      default: color === accent
    }));
    const bannerOptions = PROFILE_BANNERS.map((name) => ({
      label: name[0].toUpperCase() + name.slice(1),
      value: name,
      description: name === "midnight" ? "Avero's original dark theme." : "Use the " + name + " gradient.",
      default: !profile?.profileBannerImage && name === banner
    }));
    const styleOptions = [
      { label: "Remove frame", value: "frame:none", description: "Use the default accent outline." },
      ...PROFILE_FRAME_IDS.filter((id) => owned.has(id)).map((id) => ({
        label: PROFILE_FRAME_NAMES.get(id), value: "frame:" + id, description: "Equip this owned profile frame."
      })),
      { label: "Remove avatar decoration", value: "deco:none", description: "Remove the decoration around your avatar." },
      ...PROFILE_DECORATIONS.filter((id) => owned.has(id)).map((id) => ({
        label: PROFILE_DECORATION_NAMES.get(id), value: "deco:" + id, description: "Equip this owned avatar decoration."
      }))
    ];
    const titleOptions = [
      { label: "No title", value: "none", description: "Remove the title from your profile card.", default: !equippedTitle },
      ...memberTitles.map((entry) => TITLE_CATALOG.find((title) => title.id === entry.titleId)).filter(Boolean).slice(0, 24).map((title) => ({
        label: title.name.slice(0, 100), value: title.id, description: title.description.slice(0, 100),
        default: equippedTitle?.id === title.id
      }))
    ];
    const badgeOptions = ownedBadgeOptions(ownedBadges, selectedBadgeIds);
    container.addActionRowComponents(
      profileSelect(viewerId, "profile_accent_select", "Choose your accent color", accentOptions),
      profileSelect(viewerId, "profile_banner_select", profile?.profileBannerImage ? "Custom banner active · choose a preset" : "Choose a banner style", bannerOptions),
      profileSelect(viewerId, "profile_style_select", "Frame: " + (equippedFrame?.name ?? "Default") + " · Deco: " + (equippedDecoration?.name ?? "None"), styleOptions),
      profileSelect(viewerId, "profile_title_select", "Choose an unlocked title", titleOptions),
      profileSelect(viewerId, "profile_badges_select", "Choose up to 5 showcased badges", badgeOptions,
        ownedBadges.length ? { minValues: 0, maxValues: Math.min(5, ownedBadges.length) } : { minValues: 1, maxValues: 1, disabled: true })
    );
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      "-# Select an option to apply it instantly. Upload a custom image with **/profile banner:** or set text with **/profile bio:**. Badges support multi-select."
    ));
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# AVERO • GLOBAL PROFILE"));
  }
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    files: [new AttachmentBuilder(card, { name: "profile-card.png" }), new AttachmentBuilder(professor, { name: "avero-professor.png" })],
    allowedMentions: { parse: [] }
  };
}

export async function downloadProfileBanner(attachment) {
  if (!attachment || typeof attachment.url !== "string") throw new TypeError("Attach a PNG, JPEG, or WebP image to upload as your profile banner.");
  const contentType = String(attachment.contentType ?? "").split(";")[0].toLowerCase();
  if (!["image/png", "image/jpeg", "image/webp"].includes(contentType) || attachment.size > 5 * 1024 * 1024) {
    throw new RangeError("Profile banners must be PNG, JPEG, or WebP images no larger than 5 MB.");
  }
  const url = new URL(attachment.url);
  if (url.protocol !== "https:" || !["cdn.discordapp.com", "media.discordapp.net"].includes(url.hostname)) {
    throw new TypeError("Only images uploaded directly to Discord can be used as profile banners.");
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Discord could not provide that uploaded image.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1 || bytes.length > 5 * 1024 * 1024) throw new RangeError("Profile banner images must be no larger than 5 MB.");
  const image = await loadImage(bytes);
  if (image.width < 320 || image.height < 160 || image.width > 4096 || image.height > 4096) {
    throw new RangeError("Profile banners must be between 320×160 and 4096×4096 pixels.");
  }
  return { bytes, contentType };
}

export const profileCommand = Object.freeze({
  data: Object.freeze({
    name: "profile",
    description: "View and customize your Avero profile card.",
    options: [
      { type: 6, name: "member", description: "Member profile to view.", required: false },
      { type: 11, name: "banner", description: "Upload a PNG, JPEG, or WebP custom profile banner (max 5 MB).", required: false },
      { type: 3, name: "bio", description: "Set your profile bio (120 characters max). Use clear to remove it.", required: false, max_length: 120 }
    ]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Profile command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Profiles are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const target = interaction.options.getUser("member") ?? interaction.user;
    const upload = interaction.options.getAttachment?.("banner") ?? null;
    const bio = interaction.options.getString?.("bio") ?? null;
    if ((upload || bio !== null) && target.id !== interaction.user.id) {
      await interaction.reply({ content: "You can only upload a banner to your own profile.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (bio !== null) {
      await updateProfileCustomization(prisma, interaction.guildId, interaction.user.id, { profileBio: bio.trim().toLowerCase() === "clear" ? null : bio.trim() || null });
    }
    if (upload) {
      try {
        const { bytes, contentType } = await downloadProfileBanner(upload);
        const result = await updateProfileCustomization(prisma, interaction.guildId, interaction.user.id, {
          profileBannerImage: bytes,
          profileBannerImageType: contentType
        });
        if (!result.updated) throw new Error("The custom banner could not be saved.");
      } catch (error) {
        await interaction.reply({ content: error instanceof TypeError || error instanceof RangeError ? error.message : "Avero couldn't save that banner. Please try another image.", flags: MessageFlags.Ephemeral });
        return;
      }
    }
    await interaction.reply(await renderProfilePayload(prisma, interaction.guildId, target, interaction.user.id, target.id === interaction.user.id));
  }
});

export function showProfileBioModal(interaction) {
  const input = new TextInputBuilder()
    .setCustomId("bio")
    .setLabel("Profile bio")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(120)
    .setPlaceholder("A short line about you (120 characters max).");
  const modal = new ModalBuilder()
    .setCustomId("avero-profile-bio|" + interaction.user.id)
    .setTitle("Customize your profile bio")
    .addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

export async function handleProfileBioModal(interaction, prisma) {
  const [, ownerId] = interaction.customId.split("|");
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: "That profile editor belongs to another member.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const bio = interaction.fields.getTextInputValue("bio");
  await updateProfileCustomization(prisma, interaction.guildId, interaction.user.id, { profileBio: bio.trim() || null });
  const payload = await renderProfilePayload(prisma, interaction.guildId, interaction.user);
  await interaction.update({ components: payload.components, files: payload.files, attachments: [] });
  return true;
}
