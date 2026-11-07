import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags,
  SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, TextDisplayBuilder, ThumbnailBuilder
} from "discord.js";
import { randomInt } from "node:crypto";
import { THEME } from "../../averoui/theme.js";
import { getAssetSymbol, getCollectibleAssetId, getRarityAssetId } from "../../averoui/assets.js";
import { renderRegisteredAsset } from "../../averoui/render-asset.js";
import { awardGameReward, claimDailyReward, claimScavengeReward, getCurrencyAccount, getCurrencyPurchases, purchaseCurrencyItem, recordGuessResult, recordGameResult } from "../db/currency-repository.js";
import { equipProfileBadge, equipProfileFrame, getMemberProfile, unequipProfileBadge, unequipProfileFrame, updateProfileCustomization } from "../db/member-repository.js";
import { renderProfilePayload, PROFILE_ACCENTS, PROFILE_DECORATIONS, PROFILE_FRAME_IDS } from "./commands/profile.js";
import { PROFILE_BANNERS } from "../../averoui/profile-card.js";
import { runJobShift } from "../db/work-repository.js";
import { SHOP_ITEMS, SHOP_CATEGORIES } from "./shop-catalog.js";
import { WORK_JOBS } from "./work-catalog.js";
import { buildCollectionSetProgress } from "./collection-sets.js";
import { createVaultChallenge } from "./vault-puzzle.js";
import { renderAchievementsPage } from "./commands/achievements.js";
import { renderTitlesPage } from "./commands/titles.js";
import {
  DAILY_REWARD, DAILY_COOLDOWN_MS, SCAVENGE_COOLDOWN_MS,
  SCAVENGE_REWARD_MIN, SCAVENGE_REWARD_MAX,
  GUESS_REWARD, GUESS_REWARD_COOLDOWN_MS
} from "./economy-rules.js";
export const SCAVENGE_ROUTES = Object.freeze([
  Object.freeze({
    id: "archive",
    name: "Old Server Archive",
    description: "Explore dusty message logs and forgotten community keepsakes.",
    items: Object.freeze([{ id: "neon_badge", weight: 70 }, { id: "vault_badge", weight: 25 }, { id: "avero_relic", weight: 5 }])
  }),
  Object.freeze({
    id: "plaza",
    name: "Neon Plaza",
    description: "Check the bright stalls and tucked-away corners of the city hub.",
    items: Object.freeze([{ id: "neon_badge", weight: 45 }, { id: "starlight_badge", weight: 35 }, { id: "prism_crown", weight: 20 }])
  }),
  Object.freeze({
    id: "garden",
    name: "Moonlit Garden",
    description: "Follow the lantern path and look for rare celestial keepsakes.",
    items: Object.freeze([{ id: "moonlit_token", weight: 60 }, { id: "prism_crown", weight: 30 }, { id: "avero_relic", weight: 10 }])
  })
]);
export function getScavengeDropChance(ownedTools = []) {
  const tools = ownedTools instanceof Set ? ownedTools : new Set(ownedTools);
  return tools.has("lucky_compass") ? 18 : 12;
}
export function buildScavengeSearchPool(route, ownedTools = []) {
  if (!route || !Array.isArray(route.items)) throw new TypeError("A valid expedition route is required.");
  const tools = ownedTools instanceof Set ? ownedTools : new Set(ownedTools);
  const pool = route.items.map((entry) => ({ ...entry }));
  if (tools.has("library_card")) pool.push(
    { id: "star_pin", weight: 6 }, { id: "tiny_trophy", weight: 3 }, { id: "comet_trail", weight: 2 }
  );
  if (tools.has("starlight_compass")) {
    for (const entry of pool) {
      const found = SHOP_ITEMS.find((candidate) => candidate.id === entry.id);
      if (["EPIC", "LEGENDARY", "MYTHIC"].includes(found?.rarity)) entry.weight = Math.ceil(entry.weight * 1.5);
    }
  }
  return pool;
}
const WORK_TASKS = Object.freeze(["Sorted the community archive", "Designed a tiny server banner", "Helped organize the event board", "Delivered a stack of digital mail", "Tidied the Avero workshop"]);
const CHOICES = Object.freeze(["rock", "paper", "scissors"]);
const BEATS = Object.freeze({ rock: "scissors", paper: "rock", scissors: "paper" });
const LABELS = Object.freeze({ rock: "Rock", paper: "Paper", scissors: "Scissors" });
const COIN_ICON = getAssetSymbol("coin");
const AVATAR_DECORATION_IDS = new Set(PROFILE_DECORATIONS);
function collectibleButtonEmoji(itemId) {
  const emojis = { neon_badge: "👾", vault_badge: "🐀", starlight_badge: "📡", moonlit_token: "🛸", prism_crown: "🧪", avero_relic: "🪩" };
  return emojis[itemId] ?? "🏅";
}
function collectibleIcon(item) {
  return getAssetSymbol(getRarityAssetId(item?.rarity)) + " " + (item?.icon ?? "");
}

export function componentId(userId, action, arg = "") {
  return ["avero", userId, action, arg].filter((part) => part !== "").join("|");
}
export function readComponentId(customId) {
  if (typeof customId !== "string") return null;
  const parts = customId.split("|");
  if (parts.length < 3 || parts.length > 4) return null;
  const [namespace, userId, action, arg] = parts;
  if (namespace !== "avero" || !userId || !action) return null;
  return { userId, action, arg };
}
export function createGamePanel({ title, description, sections = [], sectionButtons = [], sectionThumbnails = [], footer = "AVERO • GAMES & COINS", eyebrow = "GAMES & COINS", color = THEME.colors.primary, buttons = [], selectMenus = [], separators = false }) {
  const customIds = [...sectionButtons.flat(), ...buttons].map((entry) => entry.customId).filter(Boolean)
    .concat(selectMenus.flatMap((row) => row.components.map((component) => component.data.custom_id).filter(Boolean)));
  if (new Set(customIds).size !== customIds.length) {
    throw new RangeError("Avero panel contains duplicate interactive component IDs.");
  }
  const container = new ContainerBuilder().setAccentColor(0x3A3D45);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# AVERO / " + eyebrow + "\n## " + title + "\n\n" + description));
  if (separators && (sections.length || buttons.length)) container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  for (const [index, section] of sections.entries()) {
    const thumbnail = sectionThumbnails[index];
    if (thumbnail) {
      container.addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(section))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL("attachment://" + thumbnail)));
    } else {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(section));
    }
    const sectionRow = sectionButtons[index];
    if (sectionRow?.length) {
      const row = new ActionRowBuilder().addComponents(sectionRow.map((entry) => {
        const builder = new ButtonBuilder().setCustomId(entry.customId).setLabel(entry.label).setStyle(ButtonStyle.Secondary);
        if (entry.emoji) builder.setEmoji(entry.emoji);
        if (entry.disabled) builder.setDisabled(true);
        return builder;
      }));
      container.addActionRowComponents(row);
    }
  }

  if (selectMenus.length) container.addActionRowComponents(...selectMenus);
  for (let index = 0; index < buttons.length; index += 5) {
    const row = new ActionRowBuilder().addComponents(buttons.slice(index, index + 5).map((button) => {
      const builder = new ButtonBuilder().setCustomId(button.customId).setLabel(button.label).setStyle(ButtonStyle.Secondary);
      if (button.emoji) builder.setEmoji(button.emoji);
      if (button.disabled) builder.setDisabled(true);
      return builder;
    }));
    container.addActionRowComponents(row);
  }
  if (footer) {
    if (separators) container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# " + footer));
  }
  return container;
}
export function gamePayload(panel, files = []) {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [panel],
    ...(files.length ? { files } : {})
  };
}
async function professorArtwork(size = 80) {
  const filename = "avero-professor.png";
  const image = await renderRegisteredAsset("mascot-professor", size);
  return { filename, file: new AttachmentBuilder(image, { name: filename }) };
}
async function collectibleArtwork(items, size = 192) {
  const files = [];
  const filenames = [];
  for (const [index, item] of items.entries()) {
    const filename = "avero-collectible-" + index + ".png";
    const image = await renderRegisteredAsset(getCollectibleAssetId(item.id), size);
    filenames.push(filename);
    files.push(new AttachmentBuilder(image, { name: filename }));
  }
  return { filenames, files };
}
function button(userId, action, label, arg = "", style = ButtonStyle.Secondary, emoji) {
  return { label, customId: componentId(userId, action, arg), style, emoji };
}
function navButtons(userId, includeDaily = false) {
  const buttons = [
    button(userId, "shop", "Shop", "", ButtonStyle.Primary, "🛍️"),
    button(userId, "inventory", "Inventory", "", ButtonStyle.Secondary, "🎒"),
    button(userId, "balance", "Wallet", "", ButtonStyle.Secondary, "🪙")
  ];
  buttons.push(button(userId, "work", "Work", "", ButtonStyle.Success, "🧰"));
  buttons.push(button(userId, "scavenge", "Scavenge", "", ButtonStyle.Primary, "🔎"));
  if (includeDaily) buttons.push(button(userId, "daily", "Daily +100", "", ButtonStyle.Success, "✨"));
  return buttons;
}
export function renderGames(userId) {
  const gameButtons = [
    ...[1, 2, 3, 4, 5].map((number) =>
      button(userId, "guess", "Guess " + number, String(number), ButtonStyle.Primary, "🎯")),
    ...CHOICES.map((choice) =>
      button(userId, "rps", LABELS[choice], choice, ButtonStyle.Secondary, choice === "rock" ? "✊" : choice === "paper" ? "✋" : "✌️")),
    button(userId, "coinflip", "Heads", "heads", ButtonStyle.Primary, "🪙"),
    button(userId, "coinflip", "Tails", "tails", ButtonStyle.Secondary, "🪙"),
    button(userId, "vault", "Daily Vault", "", ButtonStyle.Secondary, "🔐"),
    button(userId, "collections", "Collection Atlas", "", ButtonStyle.Secondary, "🗺️")
  ];
  return gamePayload(createGamePanel({
    title: "Choose your game",
    description: "🪙 **Coinflip** · heads or tails\n🎯 **Guess** · pick 1–5\n✊ **RPS** · choose your move\n🔐 **Vault** · solve the daily code\n\n-# Free games · no wagers · eligible wins earn virtual coins on a shared cooldown.",
    eyebrow: "GAMES",
    footer: "QUICK PLAY • FREE TO PLAY • COLLECTION ATLAS",
    buttons: gameButtons,
  }));
}
export async function renderBalance(prisma, guildId, userId) {
  const account = await getCurrencyAccount(prisma, guildId, userId);
  const balance = account?.balance ?? 0;
  return gamePayload(createGamePanel({
    title: "Your balance",
    eyebrow: "WALLET",
    description: COIN_ICON + " **" + balance.toLocaleString("en-US") + "** coins  ·  ◆ **" + (account?.gemBalance ?? 0).toLocaleString("en-US") + "** gems\n-# Global wallet · virtual currency only",
    sections: ["**Earn coins**\n✨ /daily · every 24h\n🧰 /work · every 60m\n🧭 /scavenge · every 20m\n📜 /contracts · daily goals\n🎮 /games · free mini-games", "**Earn gems**\n◆ Keep a 7-day daily-claim streak to earn 1 gem for the Gem Shop."],
    footer: "GLOBAL WALLET",
    buttons: navButtons(userId, true),
    separators: true
  }));
}
export async function renderShop(prisma, guildId, userId, page = 0, category = "all") {
  const [purchases, account] = await Promise.all([
    getCurrencyPurchases(prisma, guildId, userId),
    getCurrencyAccount(prisma, guildId, userId)
  ]);
  const activeCategory = SHOP_CATEGORIES.some((entry) => entry.id === category) ? category : "all";
  const filteredItems = activeCategory === "all" ? SHOP_ITEMS : SHOP_ITEMS.filter((item) =>
    activeCategory === "coins" ? item.currency === "coins" :
    activeCategory === "gems" ? item.currency === "gems" : item.category === activeCategory
  );
  const owned = new Set(purchases.map((purchase) => purchase.itemId));
  const pageSize = 2;
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(Math.max(Number.isInteger(page) ? page : 0, 0), pageCount - 1);
  const pageItems = filteredItems.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const badgeItems = pageItems.filter((item) => item.category === "badges");
  const artwork = await collectibleArtwork(badgeItems, 72);
  const professor = await professorArtwork(72);
  let artworkIndex = 0;
  const sections = pageItems.map((item) => {
    const status = owned.has(item.id) ? "✓ Owned" : "Available";
    const unit = item.currency === "gems" ? "gems" : "coins";
    return "**" + item.icon + " " + item.name + "** · " + item.rarity + "\n" +
      "**Price:** " + item.price.toLocaleString("en-US") + " " + unit + " · " + status + "\n" + item.description;
  });
  sections.push("**Professor’s note** · Tools now have practical effects in Scavenge, Vault, and Work.");
  const sectionButtons = pageItems.map((item) => {
    const ownedItem = owned.has(item.id);
    return [
      button(userId, "item", "Details", item.id + ":" + currentPage + ":shop", ButtonStyle.Secondary),
      { ...button(userId, "buy", ownedItem ? "Owned" : "Buy", item.id, ownedItem ? ButtonStyle.Secondary : ButtonStyle.Success), disabled: ownedItem }
    ];
  });
  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(componentId(userId, "shop_category"))
      .setPlaceholder("Make a selection")
      .addOptions(SHOP_CATEGORIES.map((entry) => ({
        label: entry.label, value: entry.id, description: entry.description, default: entry.id === activeCategory
      })))
  );
  const shopThumbnails = pageItems.map((item) => item.category === "badges" ? artwork.filenames[artworkIndex++] : null);
  shopThumbnails.push(professor.filename);
  return gamePayload(createGamePanel({
    title: "Avero shop",
    description: "◉ **" + (account?.balance ?? 0).toLocaleString("en-US") + "** coins  ·  ◆ **" +
      (account?.gemBalance ?? 0).toLocaleString("en-US") + "** gems  ·  " + filteredItems.length + " items",
    sections,
    sectionButtons,
    sectionThumbnails: shopThumbnails,
    selectMenus: [selectMenu],
    eyebrow: "SHOP / " + (SHOP_CATEGORIES.find((entry) => entry.id === activeCategory)?.label.toUpperCase() ?? "ALL"),
    footer: "VIRTUAL ITEMS ONLY",
    buttons: pageCount > 1 ? [
      { ...button(userId, "shop_page", "‹", activeCategory + ":" + Math.max(0, currentPage - 1)), disabled: currentPage === 0 },
      { ...button(userId, "shop_page", "›", activeCategory + ":" + Math.min(pageCount - 1, currentPage + 1)), disabled: currentPage === pageCount - 1 }
    ] : []
  }), [...artwork.files, professor.file]);
}
export async function renderWorkJobsPage(userId, page = 0) {
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(WORK_JOBS.length / pageSize));
  const currentPage = Math.min(Math.max(Number.isInteger(page) ? page : 0, 0), pageCount - 1);
  const jobs = WORK_JOBS.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const professor = await professorArtwork(72);
  const sections = jobs.map((job, index) =>
    "**" + (currentPage * pageSize + index + 1) + ". " + job.name + "** · " + job.salary.toLocaleString("en-US") + " coins/shift\n" + job.description
  );
  sections.push("**Professor’s tip** · Apply with `/work apply`, then complete a shift. The Repair Kit and Pocket Hourglass improve your routine.");
  const buttons = pageCount > 1 ? [
    { ...button(userId, "work_page", "‹ Previous", String(Math.max(0, currentPage - 1))), disabled: currentPage === 0 },
    { ...button(userId, "work_page", "Next ›", String(Math.min(pageCount - 1, currentPage + 1))), disabled: currentPage === pageCount - 1 }
  ] : [];
  return gamePayload(createGamePanel({
    title: "Available careers", eyebrow: "AVERO WORK · CAREER BOARD",
    description: "Browse five roles at a time. Apply with `/work apply` and select a career.",
    sections, sectionThumbnails: [null, null, null, null, null, professor.filename],
    buttons, footer: "PAGE " + (currentPage + 1) + " OF " + pageCount + " · " + WORK_JOBS.length + " CAREERS"
  }), [professor.file]);
}
export async function renderInventory(prisma, guildId, userId, page = 0) {
  const purchases = await getCurrencyPurchases(prisma, guildId, userId);
  const itemMap = new Map(SHOP_ITEMS.map((item) => [item.id, item]));
  const items = purchases.map((purchase) => itemMap.get(purchase.itemId)).filter(Boolean);
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(Number.isInteger(page) ? page : 0, 0), pageCount - 1);
  const pageItems = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const totalMarketValue = items.reduce((sum, item) => sum + item.price, 0);
  const pageMarketValue = pageItems.reduce((sum, item) => sum + item.price, 0);
  const collection = pageItems.length
    ? pageItems.map((item) => collectibleIcon(item) + " **" + item.name + "** · " + item.rarity).join("\\n")
    : "No collectibles yet. Browse the shop to get your first one.";
  const progress = Math.round((items.length / SHOP_ITEMS.length) * 100);
  const completedSets = buildCollectionSetProgress(items.map((item) => item.id)).filter((set) => set.complete).length;
  const pageButtons = [
    { ...button(userId, "collection_first", "≪", "0"), disabled: currentPage === 0 },
    { ...button(userId, "collection_prev", "‹", String(Math.max(0, currentPage - 1))), disabled: currentPage === 0 },
    button(userId, "inventory", "↻", String(currentPage)),
    { ...button(userId, "collection_next", "›", String(Math.min(pageCount - 1, currentPage + 1))), disabled: currentPage === pageCount - 1 },
    { ...button(userId, "collection_last", "≫", String(pageCount - 1)), disabled: currentPage === pageCount - 1 }
  ];
  const itemButtons = pageItems.map((item) => button(userId, "item", item.name, item.id + ":" + currentPage + ":inventory", ButtonStyle.Secondary, collectibleButtonEmoji(item.id)));
  return gamePayload(createGamePanel({
    title: "Your inventory",
    eyebrow: "COLLECTION",
    description: "**Total Market Value:** " + totalMarketValue.toLocaleString("en-US") + "\\n**Page Market Value:** " + pageMarketValue.toLocaleString("en-US"),
    sections: [collection, "**Collection progress:** " + items.length + "/" + SHOP_ITEMS.length + " · " + progress + "%\\n**Sets completed:** " + completedSets + "/3"],
    color: items.length === SHOP_ITEMS.length ? THEME.colors.success : THEME.colors.primary,
    buttons: [...itemButtons, ...pageButtons, button(userId, "collections", "Set atlas", "", ButtonStyle.Secondary, "🗺️"), button(userId, "shop", "Shop", "", ButtonStyle.Secondary, "🛍️")],
    footer: "PAGE " + (currentPage + 1) + " OF " + pageCount,
    separators: true
  }));
}
export async function renderCollectionSets(prisma, guildId, userId, controlUserId = userId, page = 0) {
  const purchases = await getCurrencyPurchases(prisma, guildId, userId);
  const sets = buildCollectionSetProgress(purchases.map((purchase) => purchase.itemId));
  const completed = sets.filter((set) => set.complete).length;
  const pageSize = 7;
  const pageCount = Math.max(1, Math.ceil(sets.length / pageSize));
  const currentPage = Math.min(Math.max(Number.isInteger(page) ? page : 0, 0), pageCount - 1);
  const pageSets = sets.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const sections = pageSets.map((set) =>
    (set.complete ? "✓ " : "◇ ") + set.icon + " **" + set.name + "** · " + set.ownedCount + "/" + set.totalCount + "\n" +
    set.items.map((item) => (item.owned ? "✓ " : "◇ ") + item.name).join(" · ") + "\n" +
    "**Title:** " + set.title + (set.complete ? " · Unlocked" : " · " + set.progress + "%")
  );
  return gamePayload(createGamePanel({
    title: "The Collection Atlas",
    eyebrow: "AVERO • COLLECTION ATLAS",
    description: "**" + completed + " / " + sets.length + " themed sets completed**\nCollect through the shop or the matching expedition. Set titles are cosmetic milestones and never add coins.",
    sections,
    color: completed === sets.length ? THEME.colors.success : THEME.colors.primary,
    buttons: [
      ...(pageCount > 1 ? [
        { ...button(controlUserId, "collections_page", "← Previous", String(Math.max(0, currentPage - 1))), disabled: currentPage === 0 },
        { ...button(controlUserId, "collections_page", "Next →", String(Math.min(pageCount - 1, currentPage + 1))), disabled: currentPage === pageCount - 1 }
      ] : []),
      button(controlUserId, "inventory", "My collection", "", ButtonStyle.Secondary, "🎒"),
      button(controlUserId, "shop", "Browse shop", "", ButtonStyle.Primary, "🛍️"),
      button(controlUserId, "balance", "Wallet", "", ButtonStyle.Secondary, "🪙")
    ],
    footer: "COLLECTION ATLAS • GLOBAL PROGRESS",
  }));
}
export async function renderItemDetails(prisma, guildId, userId, itemId, page = 0, source = "inventory") {
  const item = SHOP_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) return gamePayload(createGamePanel({
    title: "Collectible unavailable",
    description: "That item is no longer in the Avero catalog.",
    eyebrow: "COLLECTION",
    buttons: [button(userId, source === "shop" ? "shop" : "inventory", source === "shop" ? "Back to shop" : "Back to collection", source === "shop" ? "" : String(page), ButtonStyle.Primary)]
  }));
  const [purchases, account, profile] = await Promise.all([
    getCurrencyPurchases(prisma, guildId, userId),
    getCurrencyAccount(prisma, guildId, userId),
    getMemberProfile(prisma, guildId, userId)
  ]);
  const owned = purchases.some((purchase) => purchase.itemId === item.id);
  const equipped = profile?.equippedBadgeItemId === item.id;
  const frameEquipped = profile?.equippedFrameItemId === item.id;
  const avatarDecorationEquipped = profile?.equippedAvatarDecorationId === item.id;
  return gamePayload(createGamePanel({
    title: collectibleIcon(item) + " " + item.name,
    eyebrow: "ITEM DETAILS",
    description: "### " + item.rarity + " COLLECTIBLE\n" + item.description + "\n\n" +
      (owned ? "✓ **In your collection**" : "◇ **Not collected yet**") + (equipped ? "\n✦ **Equipped badge**" : "") + (frameEquipped ? "\n▧ **Equipped profile frame**" : "") +
      "\nCatalog price: **" + item.price.toLocaleString("en-US") + " " + (item.currency === "gems" ? "gems" : "coins") + "**" +
      "\nYour balance: **" + (item.currency === "gems" ? (account?.gemBalance ?? 0) : (account?.balance ?? 0)).toLocaleString("en-US") + " " + (item.currency === "gems" ? "gems" : "coins") + "**",
    footer: "COLLECTIBLE CODE • " + item.id.toUpperCase(),
    color: owned ? THEME.colors.success : THEME.colors.primary,
    buttons: [
      button(userId, source === "shop" ? "shop" : "inventory", source === "shop" ? "Back to shop" : "Back to collection", source === "shop" ? "" : String(page), ButtonStyle.Secondary, source === "shop" ? "🛍️" : "🎒"),
      ...(owned && item.category === "badges" ? [equipped ? button(userId, "unequip_badge", "Unequip badge", item.id, ButtonStyle.Secondary) : button(userId, "equip_badge", "Equip badge", item.id, ButtonStyle.Success)] :
        owned && AVATAR_DECORATION_IDS.has(item.id) ? [avatarDecorationEquipped ? button(userId, "unequip_avatar_decoration", "Remove avatar deco", item.id, ButtonStyle.Secondary) : button(userId, "equip_avatar_decoration", "Equip avatar deco", item.id, ButtonStyle.Success)] :
        owned && item.category === "cosmetics" ? [frameEquipped ? button(userId, "unequip_frame", "Remove frame", item.id, ButtonStyle.Secondary) : button(userId, "equip_frame", "Use as frame", item.id, ButtonStyle.Success)] :
        owned ? [] : [button(userId, "buy", "Unlock · " + item.price, item.id, ButtonStyle.Primary)]),
      ...(source === "shop" ? [] : [button(userId, "shop", "Browse shop", "", ButtonStyle.Secondary, "🛍️")])
    ]
  }));
}
export function renderScavenge(result, userId, route, item) {
  if (!result.claimed) {
    const next = new Date(result.account.lastScavengeAt.getTime() + SCAVENGE_COOLDOWN_MS);
    return gamePayload(createGamePanel({
      title: "You're on cooldown.",
      description: "You've explored recently. Your next run opens <t:" + Math.floor(next.getTime() / 1000) + ":R>.",
      eyebrow: "SCAVENGE",
      color: THEME.colors.warning,
      footer: "ONE EXPEDITION EVERY 10 MINUTES",
      buttons: navButtons(userId, true)
    }));
  }
  const dropText = result.itemId && item
    ? "\n\n🎁 **New collectible**\n" + item.icon + " **" + item.name + "** · " + item.rarity + "\nAdded to your collection."
    : result.duplicateItemId && item
      ? "\n\n🔁 **Duplicate find** · " + item.icon + " **" + item.name + "**\nConverted to **+" + result.bonus + " coins**."
      : "";
  return gamePayload(createGamePanel({
    title: result.itemId ? "New find!" : "Run complete.",
    description: "### 🧭 " + route.name + "\n" + route.description + "\n\n✦ **+" + result.amount + " coins**" + dropText +
      "\n\nWallet: **" + result.account.balance.toLocaleString("en-US") + " coins**\nNext run in 20 minutes.",
    eyebrow: "SCAVENGE",
    color: result.itemId ? THEME.colors.success : THEME.colors.primary,
    footer: "REWARDS SAVED • FREE TO PLAY",
    buttons: [button(userId, "scavenge", "Run it back", route.id, ButtonStyle.Primary, "🧭"), ...navButtons(userId, true).slice(0, 4)]
  }));
}
export async function runScavenge(prisma, guildId, userId, routeId = null) {
  const route = routeId
    ? SCAVENGE_ROUTES.find((candidate) => candidate.id === routeId)
    : SCAVENGE_ROUTES[randomInt(SCAVENGE_ROUTES.length)];
  if (!route) throw new RangeError("Choose a valid scavenge route.");
  const amount = randomInt(SCAVENGE_REWARD_MIN, SCAVENGE_REWARD_MAX + 1);
  const purchases = await getCurrencyPurchases(prisma, guildId, userId);
  const ownedTools = new Set(purchases.map((purchase) => purchase.itemId));
  const dropChance = getScavengeDropChance(ownedTools);
  const searchPool = buildScavengeSearchPool(route, ownedTools);
  const drop = randomInt(100) < dropChance;
  let itemId = null;
  if (drop) {
    const totalWeight = searchPool.reduce((sum, candidate) => sum + candidate.weight, 0);
    let ticket = randomInt(totalWeight);
    for (const candidate of searchPool) {
      ticket -= candidate.weight;
      if (ticket < 0) { itemId = candidate.id; break; }
    }
  }
  const result = await claimScavengeReward(prisma, guildId, userId, {
    amount,
    cooldownMs: SCAVENGE_COOLDOWN_MS,
    itemId
  });
  return renderScavenge(result, userId, route, itemId ? SHOP_ITEMS.find((candidate) => candidate.id === itemId) : null);
}
export function renderWork(result, userId) {
  if (!result.worked) {
    const description = result.reason === "not_employed"
      ? "Choose a career with **/work list**, apply, then return here for your next shift."
      : "Your next shift opens " + (result.nextAt ? "<t:" + Math.floor(result.nextAt.getTime() / 1000) + ":R>." : "soon.");
    return gamePayload(createGamePanel({
      title: result.reason === "not_employed" ? "Choose a career first." : "You're off the clock.",
      description, eyebrow: "WORKSHOP", color: THEME.colors.warning,
      footer: "CAREER SHIFT • " + (result.cooldownMs === 55 * 60 * 1000 ? "55" : "60") + " MINUTE COOLDOWN", buttons: navButtons(userId, true)
    }));
  }
  return gamePayload(createGamePanel({
    title: "Shift done.",
    description: "### 🧰 " + result.job.name + "\n\n✦ **+" + result.salary.toLocaleString("en-US") + " coins**\nWallet: **" + result.account.balance.toLocaleString("en-US") + " coins**\n" + result.current.shifts + " shifts completed · " + result.current.promotions + "/3 promotions" + (result.promoted ? "\n\n★ Promotion earned!" : "") + "\n\nBack in " + (result.cooldownMs === 55 * 60 * 1000 ? "55" : "60") + " minutes.",
    eyebrow: "WORKSHOP", color: THEME.colors.success,
    footer: "CAREER SHIFT • REWARD ADDED TO YOUR GLOBAL WALLET", buttons: navButtons(userId, true)
  }));
}
export async function runWork(prisma, guildId, userId) {
  const purchases = await getCurrencyPurchases(prisma, guildId, userId);
  const ownedTools = new Set(purchases.map((purchase) => purchase.itemId));
  const result = await runJobShift(prisma, guildId, userId, {
    cooldownMs: ownedTools.has("hourglass") ? 55 * 60 * 1000 : undefined,
    bonusCoins: ownedTools.has("repair_kit") ? 5 : 0
  });
  return renderWork(result, userId);
}
export function renderDaily(result, userId, { reward = DAILY_REWARD, perk = null } = {}) {
  const perkLine = perk?.dailyBonus ? "\n\n" + perk.flair + " perk: **+" + perk.dailyBonus + " coins**." : "";
  if (!result.claimed) {
    const nextClaim = new Date(result.account.lastDailyAt.getTime() + DAILY_COOLDOWN_MS);
    return gamePayload(createGamePanel({
      title: "Already claimed.",
      description: "Today's **+" + reward + " coins** are already in your wallet." +
        "\n🔥 Streak: **" + (result.account.dailyStreak ?? 0) + " days**." + perkLine +
        "\n\nNext drop <t:" + Math.floor(nextClaim.getTime() / 1000) + ":R>.",
      eyebrow: "DAILY DROP", color: THEME.colors.warning,
      footer: "ONE CLAIM EVERY 24 HOURS", buttons: navButtons(userId)
    }));
  }
  return gamePayload(createGamePanel({
    title: "Daily claimed.",
    description: "## ✨ +" + reward + " coins\nWallet: **" + result.account.balance.toLocaleString("en-US") + " coins**" +
      "\n🔥 Streak: **" + (result.dailyStreak ?? result.account.dailyStreak ?? 1) + " days**." +
      (result.gemsAwarded ? "\n◆ **+" + result.gemsAwarded + " gem** · 7-day streak reward." : "") + perkLine +
      "\n\nSee you tomorrow.",
    eyebrow: "DAILY DROP", color: THEME.colors.success,
    footer: "REWARD ADDED TO YOUR GLOBAL WALLET", buttons: navButtons(userId)
  }));
}
export function renderGuess(guess, answer, result, userId) {
  const won = guess === answer;
  const rewarded = won && result?.awarded === true;
  const nextReward = result?.account?.lastGameRewardAt
    ? new Date(result.account.lastGameRewardAt.getTime() + GUESS_REWARD_COOLDOWN_MS)
    : null;
  const outcome = rewarded
    ? "✦ **+" + GUESS_REWARD + " coins**\nBalance: **" + result.account.balance.toLocaleString("en-US") + "**."
    : won
      ? "Correct guess! Your coin reward is still cooling down." +
        (nextReward ? "\nNext reward: <t:" + Math.floor(nextReward.getTime() / 1000) + ":R>" : "")
      : "No coins lost. Try again.";
  return gamePayload(createGamePanel({
    title: rewarded ? "Perfect guess!" : won ? "Correct guess!" : "Not this time",
    description: "### 🎯 Your pick: **" + guess + "** · Answer: **" + answer + "**\n\n" +
      outcome + "\n\n**Play again**",
    eyebrow: "GUESS",
    color: rewarded ? THEME.colors.success : won ? THEME.colors.warning : THEME.colors.primary,
    footer: "NUMBER GAME • NO WAGERS • ONE COIN REWARD EVERY 10 MINUTES",
    buttons: [1, 2, 3, 4, 5].map((number) => button(userId, "guess", String(number), String(number), number === guess ? ButtonStyle.Primary : ButtonStyle.Secondary))
      .concat(navButtons(userId).slice(0, 2))
  }));
}
export function renderVaultChallenge(challenge, userId, { hasNotebook = false } = {}) {
  return gamePayload(createGamePanel({
    title: "Today's vault is ready",
    eyebrow: "THE VAULT • " + challenge.date,
    description: "### 🔐 Daily three-dial puzzle\n" + challenge.clues.join("\n") +
      (hasNotebook ? "\n\n**Field Notebook hint:** the three digits add up to **" + challenge.code.split("").reduce((sum, digit) => sum + Number(digit), 0) + "**." : "") +
      "\n\nSubmit your three-digit solution with `/vault code:000`.\n-# One code submission per member per UTC day. A correct solve earns 25 coins when the shared 10-minute Guess/RPS cooldown is ready. Free play · No wagers.",
    footer: "THE VAULT • SERVER DAILY PUZZLE • FREE PLAY",
    buttons: navButtons(userId, true).slice(0, 4)
  }));
}
export function renderVault({ guess, challenge, won, reward, userId }) {
  const rewarded = won && reward?.awarded === true;
  const nextReward = reward?.account?.lastGameRewardAt
    ? new Date(reward.account.lastGameRewardAt.getTime() + GUESS_REWARD_COOLDOWN_MS)
    : null;
  const outcome = rewarded
    ? "\n\n✦ **+" + GUESS_REWARD + " coins** · Balance: **" + reward.account.balance.toLocaleString("en-US") + "**."
    : won && reward?.reason === "already_claimed"
      ? "\n\nYour Vault reward has already been claimed for today."
      : won
        ? "\n\nVault solved! Your shared game-reward cooldown is active." + (nextReward ? "\nNext reward: <t:" + Math.floor(nextReward.getTime() / 1000) + ":R>" : "")
        : "\n\nNo coins lost. Your next Vault attempt is available at 00:00 UTC.";
  return gamePayload(createGamePanel({
    title: won ? "Vault unlocked" : "Vault stays locked",
    eyebrow: "THE VAULT • " + challenge.date,
    description: "### 🔐 Daily three-dial puzzle\n" + challenge.clues.join("\n") +
      "\n\nYour code: **" + guess + "** · " + (won ? "Correct" : "Not quite") +
      (won ? "\nToday's code: **" + challenge.code + "**" : "") + outcome +
      "\n\n-# One submission per member per UTC day. No entry fee or wager; rewards share the 10-minute Guess/RPS cooldown.",
    color: rewarded ? THEME.colors.success : won ? THEME.colors.primary : THEME.colors.warning,
    footer: "THE VAULT • SERVER DAILY PUZZLE • FREE PLAY",
    buttons: navButtons(userId, true).slice(0, 4)
  }));
}
export function renderCoinflip(call, result, reward, userId) {
  const won = call === result;
  const outcome = won
    ? reward?.awarded
      ? "🎉 **You won · +" + reward.amount + " coins**\nBalance: **" + reward.account.balance.toLocaleString("en-US") + " coins**"
      : "🎉 **You won!**\nYour shared 10-minute game-reward cooldown is active, so no coins were added."
    : "Not this time — no coins were lost. Try again whenever you like.";
  return gamePayload(createGamePanel({
    title: won ? "A clean call!" : "The coin landed",
    eyebrow: "COINFLIP",
    description: "Free play · no wagers · virtual coins only\n\nYou called **" + call.toUpperCase() + "**\nAvero flipped **" + result.toUpperCase() + "**\n\n" + outcome,
    footer: "FREE PLAY • NO WAGERS • VIRTUAL COINS ONLY",
    buttons: [
      button(userId, "coinflip", "Heads", "heads", ButtonStyle.Primary, "🪙"),
      button(userId, "coinflip", "Tails", "tails", ButtonStyle.Secondary, "🪙"),
      ...navButtons(userId, true).slice(0, 2)
    ]
  }));
}
export function renderRps(playerChoice, botChoice, userId, reward = null) {
  const tie = playerChoice === botChoice;
  const won = !tie && BEATS[playerChoice] === botChoice;
  const rewardText = reward?.awarded
    ? "\n\n✦ **+" + GUESS_REWARD + " coins** · Balance: **" + reward.account.balance.toLocaleString("en-US") + "**."
    : won
      ? "\n\nYou won, but your shared game-reward cooldown is active. No coins were lost."
      : "\n\nNo coins were lost. No wagers.";
  const outcome = (tie ? "It's a tie!" : won ? "✦ **You win this round!**" : "**Avero wins this round.**") + rewardText;
  const symbols = { rock: "✊", paper: "✋", scissors: "✌️" };
  return gamePayload(createGamePanel({
    title: "Duel deck — rock, paper, scissors",
    description: "### " + symbols[playerChoice] + " You: " + LABELS[playerChoice] + "\n### " + symbols[botChoice] + " Avero: " + LABELS[botChoice] +
      "\n\n" + outcome + "\n\n**Play another round** · Free · No wagers",
    eyebrow: "DUEL DECK",
    color: tie ? THEME.colors.primary : won ? THEME.colors.success : THEME.colors.warning,
    footer: "DUEL DECK • FREE PLAY • NO WAGERS",
    buttons: CHOICES.map((choice) => button(userId, "rps", LABELS[choice], choice, choice === playerChoice ? ButtonStyle.Primary : ButtonStyle.Secondary))
      .concat(navButtons(userId).slice(0, 1))
  }));
}
export function renderBuy(result, item, userId) {
  const currency = item.currency === "gems" ? "gems" : "coins";
  const balance = currency === "gems" ? (result.account?.gemBalance ?? 0) : (result.account?.balance ?? 0);
  const success = result.purchased;
  const title = success ? "Item unlocked!" : result.reason === "owned" ? "Already in your collection" : "Not enough " + currency;
  const description = success
    ? "### " + collectibleIcon(item) + " " + item.name + "\nUnlocked for **" + item.price + " " + currency + "**.\n\nBalance: **" + balance.toLocaleString("en-US") + " " + currency + "**."
    : result.reason === "owned" ? "You already own **" + item.name + "**. Your balance was not charged again."
      : "**" + item.name + "** costs **" + item.price + " " + currency + "**.\nBalance: **" + balance.toLocaleString("en-US") + " " + currency + "**.";
  return gamePayload(createGamePanel({
    title, description, eyebrow: "SHOP", color: success ? THEME.colors.success : THEME.colors.warning, footer: "SHOP • VIRTUAL COLLECTIBLES",
    buttons: [button(userId, "shop", "Back to shop", "", ButtonStyle.Primary, "🛍️"), button(userId, "inventory", "My collection", "", ButtonStyle.Secondary, "🎒"), button(userId, "balance", "Wallet", "", ButtonStyle.Secondary, "🪙")]
  }));
}
async function runGuess(prisma, guildId, userId, guess) {
  const answer = randomInt(1, 6);
  const won = guess === answer;
  await recordGuessResult(prisma, guildId, userId, won);
  const result = won ? await awardGameReward(prisma, guildId, userId, GUESS_REWARD, { type: "guess_reward", cooldownMs: GUESS_REWARD_COOLDOWN_MS }) : null;
  return renderGuess(guess, answer, result, userId);
}
export async function runCoinflip(prisma, guildId, call, userId) {
  if (call !== "heads" && call !== "tails") throw new RangeError("Choose heads or tails.");
  const result = randomInt(2) === 0 ? "heads" : "tails";
  const won = call === result;
  await recordGameResult(prisma, guildId, userId, "coinflip", won ? "win" : "loss");
  const reward = won
    ? await awardGameReward(prisma, guildId, userId, GUESS_REWARD, {
      type: "coinflip_reward",
      cooldownMs: GUESS_REWARD_COOLDOWN_MS
    })
    : null;
  return renderCoinflip(call, result, reward, userId);
}
export async function runRps(prisma, guildId, playerChoice, userId) {
  const botChoice = CHOICES[randomInt(CHOICES.length)];
  const outcome = playerChoice === botChoice ? "tie" : BEATS[playerChoice] === botChoice ? "win" : "loss";
  await recordGameResult(prisma, guildId, userId, "rps", outcome);
  const reward = outcome === "win"
    ? await awardGameReward(prisma, guildId, userId, GUESS_REWARD, {
      type: "rps_reward",
      cooldownMs: GUESS_REWARD_COOLDOWN_MS
    })
    : null;
  return renderRps(playerChoice, botChoice, userId, reward);
}
export async function handleGameComponent(interaction, { prisma, settings } = {}) {
  const unavailable = async () => {
    await interaction.reply({
      content: "That Avero control is no longer available. Run the command again to open a fresh panel.",
      flags: MessageFlags.Ephemeral
    });
    return true;
  };
  const parsed = readComponentId(interaction.customId);
  if (!parsed) return unavailable();
  if (parsed.userId !== interaction.user.id) {
    await interaction.reply({ content: "These controls belong to the person who opened this Avero panel. Run the command to open your own.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (!interaction.guildId) {
    await interaction.reply({ content: "Avero games and currency are available inside a server.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (!prisma) throw new Error("Game component requires a database client.");
  let payload;
  switch (parsed.action) {
    case "games": payload = renderGames(interaction.user.id); break;
    case "shop": payload = await renderShop(prisma, interaction.guildId, interaction.user.id); break;
    case "shop_page": {
      const [category, pageText] = String(parsed.arg ?? "").split(":");
      const page = Number(pageText);
      if (!Number.isInteger(page) || page < 0 || page > 100) return unavailable();
      payload = await renderShop(prisma, interaction.guildId, interaction.user.id, page, category);
      break;
    }
    case "shop_category": {
      if (!interaction.isStringSelectMenu() || !interaction.values?.[0]) return unavailable();
      payload = await renderShop(prisma, interaction.guildId, interaction.user.id, 0, interaction.values[0]);
      break;
    }
    case "collections": payload = await renderCollectionSets(prisma, interaction.guildId, interaction.user.id); break;
    case "titles_page": {
      const page = Number(parsed.arg);
      if (!Number.isInteger(page) || page < 0 || page > 100) return unavailable();
      const titlePayload = await renderTitlesPage(prisma, interaction.guildId, interaction.user, interaction.user.id, page);
      await interaction.update(titlePayload);
      return true;
    }
    case "achievements_page": {
      const [targetId, pageText] = parsed.arg.split(":");
      const page = Number(pageText);
      if (!targetId || !Number.isInteger(page) || page < 0 || page > 100) return unavailable();
      const target = await interaction.client.users.fetch(targetId);
      const achievementPayload = await renderAchievementsPage(prisma, interaction.guildId, target, interaction.user.id, page);
      await interaction.update(achievementPayload);
      return true;
    }
    case "collections_page": {
      const page = Number(parsed.arg);
      if (!Number.isInteger(page) || page < 0 || page > 100) return unavailable();
      payload = await renderCollectionSets(prisma, interaction.guildId, interaction.user.id, interaction.user.id, page);
      break;
    }
    case "inventory": {
      const page = Number(parsed.arg ?? 0);
      if (!Number.isInteger(page) || page < 0 || page > 100) return unavailable();
      payload = await renderInventory(prisma, interaction.guildId, interaction.user.id, page);
      break;
    }
    case "collection_page":
    case "collection_first":
    case "collection_prev":
    case "collection_next":
    case "collection_last": {
      const page = Number(parsed.arg);
      if (!Number.isInteger(page) || page < 0 || page > 100) {
        await interaction.reply({ content: "That collection page is invalid.", flags: MessageFlags.Ephemeral });
        return true;
      }
      payload = await renderInventory(prisma, interaction.guildId, interaction.user.id, page);
      break;
    }
    case "item": {
      const parts = parsed.arg.split(":");
      const itemId = parts[0];
      const page = Number(parts[1] ?? 0);
      const source = parts[2] === "shop" ? "shop" : "inventory";
      payload = await renderItemDetails(prisma, interaction.guildId, interaction.user.id, itemId, Number.isInteger(page) && page >= 0 ? page : 0, source);
      break;
    }
    case "balance": payload = await renderBalance(prisma, interaction.guildId, interaction.user.id); break;
    case "work": payload = await runWork(prisma, interaction.guildId, interaction.user.id); break;
    case "work_page": {
      const page = Number(parsed.arg);
      if (!Number.isInteger(page) || page < 0 || page > 100) return unavailable();
      payload = await renderWorkJobsPage(interaction.user.id, page);
      break;
    }
    case "scavenge": payload = await runScavenge(prisma, interaction.guildId, interaction.user.id, parsed.arg || null); break;
    case "daily":
      payload = renderDaily(await claimDailyReward(prisma, interaction.guildId, interaction.user.id, { amount: DAILY_REWARD, cooldownMs: DAILY_COOLDOWN_MS }), interaction.user.id);
      break;
    case "equip_badge": {
      const item = SHOP_ITEMS.find((candidate) => candidate.id === parsed.arg);
      if (!item) {
        await interaction.reply({ content: "That badge is no longer available.", flags: MessageFlags.Ephemeral });
        return true;
      }
      const result = await equipProfileBadge(prisma, interaction.guildId, interaction.user.id, item.id);
      if (!result.equipped) {
        await interaction.reply({ content: "You can only equip a badge you own. Unlock it in the shop first.", flags: MessageFlags.Ephemeral });
        return true;
      }
      payload = await renderItemDetails(prisma, interaction.guildId, interaction.user.id, item.id, 0, "inventory");
      break;
    }
    case "unequip_badge": {
      await unequipProfileBadge(prisma, interaction.guildId, interaction.user.id);
      payload = await renderItemDetails(prisma, interaction.guildId, interaction.user.id, parsed.arg, 0, "inventory");
      break;
    }
    case "equip_frame": {
      const result = await equipProfileFrame(prisma, interaction.guildId, interaction.user.id, parsed.arg);
      if (!result.equipped) {
        await interaction.reply({ content: "You can only equip a profile frame you own. Unlock it in the shop first.", flags: MessageFlags.Ephemeral });
        return true;
      }
      payload = await renderItemDetails(prisma, interaction.guildId, interaction.user.id, parsed.arg, 0, "inventory");
      break;
    }
    case "unequip_frame": {
      await unequipProfileFrame(prisma, interaction.guildId, interaction.user.id);
      payload = await renderItemDetails(prisma, interaction.guildId, interaction.user.id, parsed.arg, 0, "inventory");
      break;
    }
    case "equip_avatar_decoration":
    case "unequip_avatar_decoration": {
      const itemId = parsed.action === "unequip_avatar_decoration" ? null : parsed.arg;
      const result = await updateProfileCustomization(prisma, interaction.guildId, interaction.user.id, { equippedAvatarDecorationId: itemId });
      if (!result.updated) {
        await interaction.reply({ content: "You can only equip an avatar decoration you own.", flags: MessageFlags.Ephemeral });
        return true;
      }
      payload = await renderItemDetails(prisma, interaction.guildId, interaction.user.id, parsed.arg, 0, "inventory");
      break;
    }
    case "profile_accent": {
      const profile = await getMemberProfile(prisma, interaction.guildId, interaction.user.id);
      const current = PROFILE_ACCENTS.indexOf(profile?.profileAccentColor ?? PROFILE_ACCENTS[0]);
      const next = PROFILE_ACCENTS[(current + 1) % PROFILE_ACCENTS.length];
      await updateProfileCustomization(prisma, interaction.guildId, interaction.user.id, { profileAccentColor: next });
      payload = await renderProfilePayload(prisma, interaction.guildId, interaction.user);
      break;
    }
    case "profile_banner": {
      const profile = await getMemberProfile(prisma, interaction.guildId, interaction.user.id);
      const current = PROFILE_BANNERS.indexOf(profile?.profileBanner ?? "midnight");
      const next = PROFILE_BANNERS[(current + 1) % PROFILE_BANNERS.length];
      await updateProfileCustomization(prisma, interaction.guildId, interaction.user.id, { profileBanner: next });
      payload = await renderProfilePayload(prisma, interaction.guildId, interaction.user);
      break;
    }
    case "profile_avatar": {
      const purchases = await getCurrencyPurchases(prisma, interaction.guildId, interaction.user.id);
      const owned = purchases.map((purchase) => purchase.itemId).filter((id) => PROFILE_DECORATIONS.includes(id));
      const profile = await getMemberProfile(prisma, interaction.guildId, interaction.user.id);
      const options = [null, ...owned];
      const current = options.indexOf(profile?.equippedAvatarDecorationId ?? null);
      const next = options[(current + 1) % options.length];
      if (next && !owned.length) {
        await interaction.reply({ content: "Unlock an avatar decoration in /shop first.", flags: MessageFlags.Ephemeral });
        return true;
      }
      await updateProfileCustomization(prisma, interaction.guildId, interaction.user.id, { equippedAvatarDecorationId: next });
      payload = await renderProfilePayload(prisma, interaction.guildId, interaction.user);
      break;
    }
    case "profile_frame": {
      const purchases = await getCurrencyPurchases(prisma, interaction.guildId, interaction.user.id);
      const owned = purchases.map((purchase) => purchase.itemId).filter((id) => PROFILE_FRAME_IDS.includes(id));
      const profile = await getMemberProfile(prisma, interaction.guildId, interaction.user.id);
      const options = [null, ...owned];
      const current = options.indexOf(profile?.equippedFrameItemId ?? null);
      const next = options[(current + 1) % options.length];
      if (next) await equipProfileFrame(prisma, interaction.guildId, interaction.user.id, next);
      else await unequipProfileFrame(prisma, interaction.guildId, interaction.user.id);
      payload = await renderProfilePayload(prisma, interaction.guildId, interaction.user);
      break;
    }
    case "profile_badges": {
      const purchases = await getCurrencyPurchases(prisma, interaction.guildId, interaction.user.id);
      const owned = purchases.map((purchase) => purchase.itemId)
        .filter((id) => SHOP_ITEMS.some((item) => item.id === id && item.category === "badges")).slice(0, 5);
      const profile = await getMemberProfile(prisma, interaction.guildId, interaction.user.id);
      const current = profile?.profileShowcaseBadgeIds ?? [];
      const same = current.length === owned.length && current.every((id, index) => id === owned[index]);
      await updateProfileCustomization(prisma, interaction.guildId, interaction.user.id, { profileShowcaseBadgeIds: same ? [] : owned });
      payload = await renderProfilePayload(prisma, interaction.guildId, interaction.user);
      break;
    }
    case "buy": {
      const item = SHOP_ITEMS.find((candidate) => candidate.id === parsed.arg);
      if (!item) {
        await interaction.reply({ content: "That collectible is no longer available.", flags: MessageFlags.Ephemeral });
        return true;
      }
      payload = renderBuy(await purchaseCurrencyItem(prisma, interaction.guildId, interaction.user.id, item.id, item.price, { currency: item.currency ?? "coins" }), item, interaction.user.id);
      break;
    }
    case "guess": {
      const guess = Number(parsed.arg);
      if (!Number.isInteger(guess) || guess < 1 || guess > 5) {
        await interaction.reply({ content: "Choose a number from 1 to 5.", flags: MessageFlags.Ephemeral });
        return true;
      }
      payload = await runGuess(prisma, interaction.guildId, interaction.user.id, guess);
      break;
    }
    case "coinflip":
      if (parsed.arg !== "heads" && parsed.arg !== "tails") {
        await interaction.reply({ content: "Choose heads or tails.", flags: MessageFlags.Ephemeral });
        return true;
      }
      payload = await runCoinflip(prisma, interaction.guildId, parsed.arg, interaction.user.id);
      break;
    case "vault": {
      const purchases = prisma.currencyPurchase?.findMany
        ? await getCurrencyPurchases(prisma, interaction.guildId, interaction.user.id)
        : [];
      const hasNotebook = purchases.some((purchase) => purchase.itemId === "field_notebook");
      payload = renderVaultChallenge(createVaultChallenge(interaction.guildId), interaction.user.id, { hasNotebook });
      break;
    }
    case "rps":
      if (!CHOICES.includes(parsed.arg)) {
        await interaction.reply({ content: "Choose rock, paper, or scissors.", flags: MessageFlags.Ephemeral });
        return true;
      }
      payload = await runRps(prisma, interaction.guildId, parsed.arg, interaction.user.id);
      break;
    default: return unavailable();
  }
  await interaction.update({
    components: payload.components,
    files: payload.files ?? [],
    attachments: []
  });
  return true;
}
