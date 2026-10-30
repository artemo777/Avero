import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags,
  SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder
} from "discord.js";
import { randomInt } from "node:crypto";
import { THEME } from "../../averoui/theme.js";
import { getAssetSymbol, getCollectibleAssetId, getRarityAssetId } from "../../averoui/assets.js";
import { renderRegisteredAsset } from "../../averoui/render-asset.js";
import { renderAveroCanvas } from "../../averoui/canvas.js";
import { awardGameReward, claimDailyReward, claimScavengeReward, claimWorkReward, getCurrencyAccount, getCurrencyPurchases, purchaseCurrencyItem, recordGuessResult, recordGameResult } from "../db/currency-repository.js";
import { equipProfileBadge, getMemberProfile, unequipProfileBadge } from "../db/member-repository.js";
import { SHOP_ITEMS } from "./shop-catalog.js";
import {
  DAILY_REWARD, DAILY_COOLDOWN_MS, WORK_COOLDOWN_MS, SCAVENGE_COOLDOWN_MS,
  WORK_REWARD_MIN, WORK_REWARD_MAX, SCAVENGE_REWARD_MIN, SCAVENGE_REWARD_MAX,
  GUESS_REWARD, GUESS_REWARD_COOLDOWN_MS
} from "./economy-rules.js";
const SCAVENGE_SPOTS = Object.freeze(["the old server archive", "the neon-lit plaza", "the quiet train platform", "the workshop storage room", "the moonlit garden", "the forgotten message board"]);
const SCAVENGE_ITEMS = Object.freeze([{ id: "neon_badge", weight: 55 }, { id: "vault_badge", weight: 25 }, { id: "starlight_badge", weight: 13 }, { id: "moonlit_token", weight: 6 }, { id: "prism_crown", weight: 1 }]);
const WORK_TASKS = Object.freeze(["Sorted the community archive", "Designed a tiny server banner", "Helped organize the event board", "Delivered a stack of digital mail", "Tidied the Avero workshop"]);
const CHOICES = Object.freeze(["rock", "paper", "scissors"]);
const BEATS = Object.freeze({ rock: "scissors", paper: "rock", scissors: "paper" });
const LABELS = Object.freeze({ rock: "Rock", paper: "Paper", scissors: "Scissors" });
const COIN_ICON = getAssetSymbol("coin");
function collectibleButtonEmoji(itemId) {
  const emojis = { neon_badge: "🌟", vault_badge: "🔐", starlight_badge: "✨", moonlit_token: "🌙", prism_crown: "👑", avero_relic: "💠" };
  return emojis[itemId] ?? "🏅";
}
function collectibleIcon(item) {
  return getAssetSymbol(getRarityAssetId(item?.rarity)) + " " + (item?.icon ?? "");
}

export function componentId(userId, action, arg = "") {
  return ["avero", userId, action, arg].filter((part) => part !== "").join("|");
}
export function readComponentId(customId) {
  const [namespace, userId, action, arg] = customId.split("|");
  if (namespace !== "avero" || !userId || !action) return null;
  return { userId, action, arg };
}
export function createGamePanel({ title, description, sections = [], sectionButtons = [], footer = "AVERO • GAMES & COINS", eyebrow = "GAMES & COINS", color = THEME.colors.primary, buttons = [], canvas = false, artwork = [] }) {
  const container = new ContainerBuilder().setAccentColor(color);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# " + eyebrow + "\n## " + title + "\n" + description));
  if (canvas || artwork.length) {
    const galleryItems = [];
    if (canvas) galleryItems.push(new MediaGalleryItemBuilder().setURL("attachment://avero-panel.png"));
    for (const filename of artwork) galleryItems.push(new MediaGalleryItemBuilder().setURL("attachment://" + filename));
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...galleryItems));
  }
  for (const [index, section] of sections.entries()) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(section));
    const sectionRow = sectionButtons[index];
    if (sectionRow?.length) {
      const row = new ActionRowBuilder().addComponents(sectionRow.map((entry) => {
        const builder = new ButtonBuilder().setCustomId(entry.customId).setLabel(entry.label).setStyle(entry.style ?? ButtonStyle.Secondary);
        if (entry.emoji) builder.setEmoji(entry.emoji);
        if (entry.disabled) builder.setDisabled(true);
        return builder;
      }));
      container.addActionRowComponents(row);
    }
  }

  for (let index = 0; index < buttons.length; index += 5) {
    const row = new ActionRowBuilder().addComponents(buttons.slice(index, index + 5).map((button) => {
      const builder = new ButtonBuilder().setCustomId(button.customId).setLabel(button.label).setStyle(button.style ?? ButtonStyle.Secondary);
      if (button.emoji) builder.setEmoji(button.emoji);
      if (button.disabled) builder.setDisabled(true);
      return builder;
    }));
    container.addActionRowComponents(row);
  }
  return container;
}
export function gamePayload(panel, files = []) {
  const serialized = panel.toJSON();
  const hasCanvas = serialized.components.some((component) => component.type === 12 &&
    (component.items ?? []).some((item) => item.media?.url === "attachment://avero-panel.png"));
  const attachments = [...files];
  if (hasCanvas) {
    const header = serialized.components.find((component) => component.type === 10)?.content ?? "";
    const lines = header.split("\n");
    const eyebrow = (lines[0] ?? "").split("//").at(-1)?.trim() || "GAMES & COINS";
    const title = (lines[1] ?? "## Avero").replace(/^##\s*/, "");
    const image = renderAveroCanvas({ eyebrow, title, accentColor: serialized.accent_color ?? THEME.colors.primary });
    attachments.push(new AttachmentBuilder(image, { name: "avero-panel.png" }));
  }
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [panel],
    ...(attachments.length ? { files: attachments } : {})
  };
}
async function collectibleArtwork(items) {
  const files = [];
  const filenames = [];
  for (const [index, item] of items.entries()) {
    const filename = "avero-collectible-" + index + ".png";
    const image = await renderRegisteredAsset(getCollectibleAssetId(item.id), 192);
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
      button(userId, "rps", LABELS[choice], choice, ButtonStyle.Secondary, choice === "rock" ? "✊" : choice === "paper" ? "✋" : "✌️"))
  ];
  return gamePayload(createGamePanel({
    title: "Choose your game",
    description: "## 🎯 Guess the number\nPick **1–5**. A correct guess earns **25 coins** · reward every 10m. Free to play.\n\n## ✊ Rock, paper, scissors\nFree to play · Win +25 coins when your game-reward cooldown is ready.\n\n## 🔐 The Vault\nCrack the server daily three-dial puzzle with `/vault code`. Free to play · one +25 reward per UTC day, when your shared game-reward cooldown is ready.",
    eyebrow: "GAMES",
    footer: "QUICK PLAY • FREE TO PLAY",
    buttons: gameButtons,
    canvas: false
  }));
}
export async function renderBalance(prisma, guildId, userId) {
  const account = await getCurrencyAccount(prisma, guildId, userId);
  const balance = account?.balance ?? 0;
  return gamePayload(createGamePanel({
    title: "Your wallet",
    description: "### " + COIN_ICON + " " + balance.toLocaleString("en-US") + " coins\nServer balance · No cash value\n\n**Earn coins**\n✨ /daily · +100 every 24h\n🧰 /work · +60–120 every 30m\n🔎 /scavenge · +25–55 every 10m + collectible chance\n📜 /contracts · 4 daily goals · up to +345/day\n🎯 /guess · +25 on a win · one reward every 10m\n✊ /rps · Free to play · +25 on a win, shared 10m cooldown\n🔐 /vault · Daily puzzle · one +25 reward per UTC day",
    eyebrow: "WALLET",
    footer: "WALLET • SERVER-SCOPED BALANCE",
    buttons: navButtons(userId, true)
  }));
}
export async function renderShop(prisma, guildId, userId) {
  const [purchases, account] = await Promise.all([
    getCurrencyPurchases(prisma, guildId, userId),
    getCurrencyAccount(prisma, guildId, userId)
  ]);
  const owned = new Set(purchases.map((purchase) => purchase.itemId));
  const sections = SHOP_ITEMS.map((item) => {
    const status = owned.has(item.id) ? "✓ OWNED" : "⟡ " + item.price.toLocaleString("en-US") + " coins";
    return collectibleIcon(item) + " **" + item.name + "**  ·  " + item.rarity + "\n" +
      status + "  ·  " + item.description;
  });
  const sectionButtons = SHOP_ITEMS.map((item) => {
    const detail = button(userId, "item", "Details", item.id + ":0:shop", ButtonStyle.Secondary, collectibleButtonEmoji(item.id));
    const purchase = button(userId, "buy", owned.has(item.id) ? "Owned" : "Buy · " + item.price.toLocaleString("en-US"), item.id,
      owned.has(item.id) ? ButtonStyle.Secondary : ButtonStyle.Success, owned.has(item.id) ? "☑️" : "🛒");
    if (owned.has(item.id)) purchase.disabled = true;
    return [detail, purchase];
  });
  return gamePayload(createGamePanel({
    title: "Collectible shop",
    description: "### " + COIN_ICON + " " + (account?.balance ?? 0).toLocaleString("en-US") + " coins\nBrowse the drop. Each item has its own details and purchase controls below.",
    sections,
    sectionButtons,
    eyebrow: "THE DROP",
    footer: "COLLECTIBLES • VIRTUAL ITEMS ONLY",
    buttons: [
      button(userId, "inventory", "My collection", "", ButtonStyle.Secondary, "🎒"),
      button(userId, "balance", "Wallet", "", ButtonStyle.Secondary, "🪙")
    ]
  }));
}
export async function renderInventory(prisma, guildId, userId, page = 0) {
  const purchases = await getCurrencyPurchases(prisma, guildId, userId);
  const itemMap = new Map(SHOP_ITEMS.map((item) => [item.id, item]));
  const items = purchases.map((purchase) => itemMap.get(purchase.itemId)).filter(Boolean);
  const pageSize = 4;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(Number.isInteger(page) ? page : 0, 0), pageCount - 1);
  const pageItems = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const collection = pageItems.length
    ? pageItems.map((item) => collectibleIcon(item) + " **" + item.name + "** · " + item.rarity).join("\n")
    : "No items yet. Open the shop to get your first collectible.";
  const progress = Math.round((items.length / SHOP_ITEMS.length) * 100);
  const milestones = [
    { count: 1, name: "First Find" },
    { count: 3, name: "Curator" },
    { count: SHOP_ITEMS.length, name: "Full Set" }
  ];
  const earnedMilestones = milestones.filter((milestone) => items.length >= milestone.count);
  const nextMilestone = milestones.find((milestone) => items.length < milestone.count);
  const milestoneSummary = earnedMilestones.length
    ? earnedMilestones.map((milestone) => "✓ " + milestone.name).join(" · ")
    : "No milestones yet";
  const milestoneProgress = nextMilestone
    ? " · Next: **" + nextMilestone.name + "** — " + items.length + "/" + nextMilestone.count + " items"
    : " · All collection milestones complete";
  const itemButtons = pageItems.map((item) => button(userId, "item", item.name, item.id + ":" + currentPage + ":inventory", ButtonStyle.Secondary, collectibleButtonEmoji(item.id)));
  const pageButtons = [];
  if (pageCount > 1) {
    const previous = button(userId, "collection_page", "← Previous", String(Math.max(0, currentPage - 1)), ButtonStyle.Secondary);
    const next = button(userId, "collection_page", "Next →", String(Math.min(pageCount - 1, currentPage + 1)), ButtonStyle.Secondary);
    previous.disabled = currentPage === 0;
    next.disabled = currentPage === pageCount - 1;
    pageButtons.push(previous, next);
  }
  return gamePayload(createGamePanel({
    title: "Your collection",
    eyebrow: "COLLECTION",
    description: "🎒 **" + items.length + " / " + SHOP_ITEMS.length + " starter collectibles** · " + progress + "%\n" +
      collection +
      "\n🏆 " + milestoneSummary + milestoneProgress +
      (pageCount > 1 ? "\n-# Page " + (currentPage + 1) + " of " + pageCount : items.length ? "\n-# Select an item below for its details." : ""),
    color: items.length === SHOP_ITEMS.length ? THEME.colors.success : THEME.colors.primary,
    buttons: [...itemButtons, ...pageButtons, button(userId, "shop", "Browse shop", "", ButtonStyle.Primary, "🛍️"), button(userId, "balance", "Wallet", "", ButtonStyle.Secondary, "🪙")]
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
  const artwork = await collectibleArtwork([item]);
  return gamePayload(createGamePanel({
    title: collectibleIcon(item) + " " + item.name,
    eyebrow: "ITEM DETAILS",
    description: "### " + item.rarity + " COLLECTIBLE\n" + item.description + "\n\n" +
      (owned ? "✓ **In your collection**" : "◇ **Not collected yet**") + (equipped ? "\n✦ **Equipped on your profile**" : "") +
      "\nCatalog price: **" + item.price.toLocaleString("en-US") + " coins**" +
      "\nYour balance: **" + (account?.balance ?? 0).toLocaleString("en-US") + " coins**",
    footer: "COLLECTIBLE CODE • " + item.id.toUpperCase(),
    artwork: artwork.filenames,
    color: owned ? THEME.colors.success : THEME.colors.primary,
    buttons: [
      button(userId, source === "shop" ? "shop" : "inventory", source === "shop" ? "Back to shop" : "Back to collection", source === "shop" ? "" : String(page), ButtonStyle.Secondary, source === "shop" ? "🛍️" : "🎒"),
      ...(owned ? [equipped ? button(userId, "unequip_badge", "Unequip badge", item.id, ButtonStyle.Secondary, "➖") : button(userId, "equip_badge", "Equip badge", item.id, ButtonStyle.Success, "🏅")] : [button(userId, "buy", "Unlock · " + item.price, item.id, ButtonStyle.Primary, "🛒")]),
      ...(source === "shop" ? [] : [button(userId, "shop", "Browse shop", "", ButtonStyle.Secondary, "🛍️")])
    ]
  }), artwork.files);
}
export function renderScavenge(result, userId, spot, item) {
  if (!result.claimed) {
    const next = new Date(result.account.lastScavengeAt.getTime() + SCAVENGE_COOLDOWN_MS);
    return gamePayload(createGamePanel({
      title: "Nothing new to search yet",
      description: "You have already checked the area recently.\n\nTry again: <t:" + Math.floor(next.getTime() / 1000) + ":R>",
      eyebrow: "SCAVENGE",
      color: THEME.colors.warning,
      footer: "SCAVENGE • ONE SEARCH EVERY 10 MINUTES",
      buttons: navButtons(userId, true)
    }));
  }
  const dropText = result.itemId && item
    ? "\n\n🎁 **Collectible found!**\n" + item.icon + " **" + item.name + "** · " + item.rarity + "\nAdded to your collection."
    : result.duplicateItemId && item
      ? "\n\n🔁 You found another " + item.icon + " **" + item.name + "**, which you already own.\nDuplicate bonus: **+" + result.bonus + " coins**."
      : "";
  return gamePayload(createGamePanel({
    title: result.itemId ? "Something rare!" : "Search complete",
    description: "### 🔎 You searched " + spot + ".\n\n✦ **+" + result.amount + " coins**" + dropText +
      "\n\nBalance: **" + result.account.balance.toLocaleString("en-US") + " coins**\nNext search in 10 minutes.",
    eyebrow: "SCAVENGE",
    color: result.itemId ? THEME.colors.success : THEME.colors.primary,
    footer: "SCAVENGE • COINS AND COLLECTIBLES SAVED",
    buttons: [button(userId, "scavenge", "Search again", "", ButtonStyle.Primary, "🔎"), ...navButtons(userId, true).slice(0, 4)]
  }));
}
export async function runScavenge(prisma, guildId, userId) {
  const spot = SCAVENGE_SPOTS[randomInt(SCAVENGE_SPOTS.length)];
  const amount = randomInt(SCAVENGE_REWARD_MIN, SCAVENGE_REWARD_MAX + 1);
  const drop = randomInt(100) < 12;
  let itemId = null;
  if (drop) {
    const totalWeight = SCAVENGE_ITEMS.reduce((sum, candidate) => sum + candidate.weight, 0);
    let ticket = randomInt(totalWeight);
    for (const candidate of SCAVENGE_ITEMS) {
      ticket -= candidate.weight;
      if (ticket < 0) { itemId = candidate.id; break; }
    }
  }
  const result = await claimScavengeReward(prisma, guildId, userId, {
    amount,
    cooldownMs: SCAVENGE_COOLDOWN_MS,
    itemId
  });
  return renderScavenge(result, userId, spot, itemId ? SHOP_ITEMS.find((candidate) => candidate.id === itemId) : null);
}
export function renderWork(result, userId, task) {
  if (!result.claimed) {
    const nextWork = new Date(result.account.lastWorkAt.getTime() + WORK_COOLDOWN_MS);
    return gamePayload(createGamePanel({
      title: "Shift already completed",
      description: "Your last shift is still on cooldown.\n\nNext shift: <t:" + Math.floor(nextWork.getTime() / 1000) + ":R>",
      eyebrow: "WORKSHOP",
      color: THEME.colors.warning,
      footer: "WORK • ONE SHIFT EVERY 30 MINUTES",
      buttons: navButtons(userId, true)
    }));
  }
  return gamePayload(createGamePanel({
    title: "Shift complete!",
    description: "### 🧰 " + task + "\n\n✦ **+" + result.amount + " coins**\nBalance: **" + result.account.balance.toLocaleString("en-US") + " coins**\n\nYour next shift is available in 30 minutes.",
    eyebrow: "WORKSHOP",
    color: THEME.colors.success,
    footer: "WORK • REWARD SAVED TO YOUR SERVER WALLET",
    buttons: navButtons(userId, true)
  }));
}
export async function runWork(prisma, guildId, userId) {
  const task = WORK_TASKS[randomInt(WORK_TASKS.length)];
  const amount = randomInt(WORK_REWARD_MIN, WORK_REWARD_MAX + 1);
  const result = await claimWorkReward(prisma, guildId, userId, {
    amount,
    cooldownMs: WORK_COOLDOWN_MS
  });
  return renderWork(result, userId, task);
}
export function renderDaily(result, userId) {
  if (!result.claimed) {
    const nextClaim = new Date(result.account.lastDailyAt.getTime() + DAILY_COOLDOWN_MS);
    return gamePayload(createGamePanel({
      title: "Daily drop already claimed",
      description: "You already claimed **+100 coins**.\n\nNext drop: <t:" + Math.floor(nextClaim.getTime() / 1000) + ":R>",
      eyebrow: "DAILY DROP",
      color: THEME.colors.warning, footer: "DAILY DROP • ONE CLAIM EVERY 24 HOURS", buttons: navButtons(userId)
    }));
  }
  return gamePayload(createGamePanel({
    title: "Daily drop claimed!",
    description: "## ✨ +100 coins\nBalance: **" + result.account.balance.toLocaleString("en-US") + "**\n\nNext drop in 24 hours.",
    eyebrow: "DAILY DROP",
    color: THEME.colors.success, footer: "DAILY DROP • REWARD ADDED TO YOUR WALLET", buttons: navButtons(userId)
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
        : "\n\nNo coins lost. Try another code when ready.";
  return gamePayload(createGamePanel({
    title: won ? "Vault unlocked" : "Vault stays locked",
    eyebrow: "THE VAULT • " + challenge.date,
    description: "### 🔐 Daily three-dial puzzle\n" + challenge.clues.join("\n") +
      "\n\nYour code: **" + guess + "** · " + (won ? "Correct" : "Not quite") +
      (won ? "\nToday's code: **" + challenge.code + "**" : "") + outcome +
      "\n\n-# No entry fee or wager. One coin reward every 10 minutes, shared with Guess and RPS.",
    color: rewarded ? THEME.colors.success : won ? THEME.colors.primary : THEME.colors.warning,
    footer: "THE VAULT • SERVER DAILY PUZZLE • FREE PLAY",
    buttons: navButtons(userId, true).slice(0, 4)
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
  const success = result.purchased;
  const title = success ? "Item unlocked!" : result.reason === "owned" ? "Already in your collection" : "Not enough coins";
  const description = success
    ? "### " + collectibleIcon(item) + " " + item.name + "\nUnlocked for **" + item.price + " coins**.\n\nBalance: **" + result.account.balance.toLocaleString("en-US") + " coins**."
    : result.reason === "owned" ? "You already own **" + item.name + "**. Your coins were not charged again."
      : "**" + item.name + "** costs **" + item.price + " coins**.\nBalance: **" + result.account.balance.toLocaleString("en-US") + "**.\n\nEarn more with /daily, /work, /scavenge, /contracts, /guess, /rps or /vault.";
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
export async function handleGameComponent(interaction, { prisma } = {}) {
  const parsed = readComponentId(interaction.customId);
  if (!parsed) return false;
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
    case "inventory": payload = await renderInventory(prisma, interaction.guildId, interaction.user.id, Number(parsed.arg) || 0); break;
    case "collection_page": {
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
    case "scavenge": payload = await runScavenge(prisma, interaction.guildId, interaction.user.id); break;
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
    case "buy": {
      const item = SHOP_ITEMS.find((candidate) => candidate.id === parsed.arg);
      if (!item) {
        await interaction.reply({ content: "That collectible is no longer available.", flags: MessageFlags.Ephemeral });
        return true;
      }
      payload = renderBuy(await purchaseCurrencyItem(prisma, interaction.guildId, interaction.user.id, item.id, item.price), item, interaction.user.id);
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
    case "rps":
      if (!CHOICES.includes(parsed.arg)) {
        await interaction.reply({ content: "Choose rock, paper, or scissors.", flags: MessageFlags.Ephemeral });
        return true;
      }
      payload = await runRps(prisma, interaction.guildId, parsed.arg, interaction.user.id);
      break;
    default: return false;
  }
  await interaction.update({
    components: payload.components,
    files: payload.files ?? [],
    attachments: []
  });
  return true;
}
