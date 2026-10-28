import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags,
  SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder
} from "discord.js";
import { randomInt } from "node:crypto";
import { THEME } from "../../averoui/theme.js";
import { awardGameReward, claimDailyReward, getCurrencyAccount, getCurrencyPurchases, purchaseCurrencyItem } from "../db/currency-repository.js";
import { SHOP_ITEMS } from "./shop-catalog.js";

const DAILY_REWARD = 100;
const DAILY_COOLDOWN_MS = 86_400_000;
const WIN_REWARD = 25;
const CHOICES = Object.freeze(["rock", "paper", "scissors"]);
const BEATS = Object.freeze({ rock: "scissors", paper: "rock", scissors: "paper" });
const LABELS = Object.freeze({ rock: "Rock", paper: "Paper", scissors: "Scissors" });

export function componentId(userId, action, arg = "") {
  return ["avero", userId, action, arg].filter((part) => part !== "").join("|");
}
export function readComponentId(customId) {
  const [namespace, userId, action, arg] = customId.split("|");
  if (namespace !== "avero" || !userId || !action) return null;
  return { userId, action, arg };
}
export function createGamePanel({ title, description, footer = "AVERO • GAMES & COLLECTIONS", color = THEME.colors.primary, buttons = [] }) {
  const container = new ContainerBuilder().setAccentColor(color);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# A V E R O  / /  G A M E S\n## " + title + "\n" + description));
  if (footer) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# " + footer));
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
export function gamePayload(panel) {
  return { flags: MessageFlags.IsComponentsV2, components: [panel] };
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
  if (includeDaily) buttons.push(button(userId, "daily", "Daily +100", "", ButtonStyle.Success, "✨"));
  return buttons;
}
export async function renderBalance(prisma, guildId, userId) {
  const account = await getCurrencyAccount(prisma, guildId, userId);
  const balance = account?.balance ?? 0;
  return gamePayload(createGamePanel({
    title: "Your wallet",
    description: "### 🪙 " + balance.toLocaleString("en-US") + " Avero coins\nYour server wallet, your next unlock. Coins are virtual and have no cash value.\n\n**Ways to earn**\n✨ Daily drop · +100 every 24 hours\n🎯 Number game · +25 on a correct guess\n✂️ Rock, paper, scissors · free to play",
    footer: "WALLET • SERVER-SCOPED BALANCE",
    buttons: navButtons(userId, true)
  }));
}
export async function renderShop(prisma, guildId, userId) {
  const [purchases, account] = await Promise.all([getCurrencyPurchases(prisma, guildId, userId), getCurrencyAccount(prisma, guildId, userId)]);
  const owned = new Set(purchases.map((purchase) => purchase.itemId));
  const rows = SHOP_ITEMS.map((item) => item.icon + " **" + item.name + "** · " + item.rarity + " · " +
    (owned.has(item.id) ? "✓ **OWNED**" : "**" + item.price + " coins**") + "\n" + item.description);
  const buyButtons = SHOP_ITEMS.filter((item) => !owned.has(item.id)).map((item) =>
    button(userId, "buy", item.name + " · " + item.price, item.id, ButtonStyle.Primary, "🛒"));
  return gamePayload(createGamePanel({
    title: "The drop — collectible shop",
    description: "### 🪙 " + (account?.balance ?? 0).toLocaleString("en-US") + " coins available\nPick up a collectible with one tap. Purchases are one-time per item in this server.\n\n" +
      rows.join("\n\n") + "\n\n-# Future update: equipable badges, titles and profile themes.",
    footer: "THE DROP • VIRTUAL ITEMS ONLY",
    buttons: [...buyButtons, button(userId, "inventory", "My collection", "", ButtonStyle.Secondary, "🎒"), button(userId, "balance", "Wallet", "", ButtonStyle.Secondary, "🪙")]
  }));
}
export async function renderInventory(prisma, guildId, userId) {
  const purchases = await getCurrencyPurchases(prisma, guildId, userId);
  const itemMap = new Map(SHOP_ITEMS.map((item) => [item.id, item]));
  const items = purchases.map((purchase) => itemMap.get(purchase.itemId)).filter(Boolean);
  const collection = items.length ? items.map((item) => item.icon + " **" + item.name + "** · " + item.rarity).join("\n")
    : "Your collection is waiting for its first unlock.\nThe Neon Badge is a great first pick — open the shop to see the drop.";
  const progress = Math.round((items.length / SHOP_ITEMS.length) * 100);
  return gamePayload(createGamePanel({
    title: "Your collection",
    description: "### 🎒 " + items.length + " / " + SHOP_ITEMS.length + " starter collectibles\n" +
      "▰".repeat(items.length) + "▱".repeat(SHOP_ITEMS.length - items.length) + "  " + progress + "% complete\n\n" + collection + "\n\n" +
      (items.length === SHOP_ITEMS.length ? "✧ **Collection complete!** You found every starter collectible." : "Every collectible is a first step toward future profile customization."),
    footer: "COLLECTION • SAVED PER SERVER",
    color: items.length === SHOP_ITEMS.length ? THEME.colors.success : THEME.colors.primary,
    buttons: [button(userId, "shop", "Browse shop", "", ButtonStyle.Primary, "🛍️"), button(userId, "balance", "Wallet", "", ButtonStyle.Secondary, "🪙"), button(userId, "daily", "Daily reward", "", ButtonStyle.Success, "✨")]
  }));
}
export function renderDaily(result, userId) {
  if (!result.claimed) {
    const nextClaim = new Date(result.account.lastDailyAt.getTime() + DAILY_COOLDOWN_MS);
    return gamePayload(createGamePanel({
      title: "Daily drop already claimed",
      description: "Your **+100 coin** drop is on cooldown.\n\nNext reward: <t:" + Math.floor(nextClaim.getTime() / 1000) + ":R>\n\nKeep your collection plans ready — the next drop is on its way.",
      color: THEME.colors.warning, footer: "DAILY DROP • ONE CLAIM EVERY 24 HOURS", buttons: navButtons(userId)
    }));
  }
  return gamePayload(createGamePanel({
    title: "Daily drop claimed!",
    description: "## ✨ +100 coins\nYour new balance is **" + result.account.balance.toLocaleString("en-US") + " coins**.\n\nA little boost for your next collectible. Come back in 24 hours for another drop.",
    color: THEME.colors.success, footer: "DAILY DROP • REWARD ADDED TO YOUR WALLET", buttons: navButtons(userId)
  }));
}
export function renderGuess(guess, answer, result, userId) {
  const won = guess === answer;
  return gamePayload(createGamePanel({
    title: won ? "Perfect guess!" : "Not this time",
    description: "### 🎯 Number challenge\nYour pick: **" + guess + "** · The number: **" + answer + "**\n\n" +
      (won ? "✦ **+" + WIN_REWARD + " coins earned!**\nNew balance: **" + result.account.balance.toLocaleString("en-US") + " coins**." :
        "No coins lost — playing is always free. Try another number below.") + "\n\n**Pick a number to play again**",
    color: won ? THEME.colors.success : THEME.colors.primary,
    footer: "NUMBER GAME • NO WAGERS, NO ENTRY FEE",
    buttons: [1, 2, 3, 4, 5].map((number) => button(userId, "guess", String(number), String(number), number === guess ? ButtonStyle.Primary : ButtonStyle.Secondary))
      .concat(navButtons(userId).slice(0, 2))
  }));
}
export function renderRps(playerChoice, botChoice, userId) {
  const tie = playerChoice === botChoice;
  const won = !tie && BEATS[playerChoice] === botChoice;
  const outcome = tie ? "It's a tie!" : won ? "✦ **You win this round!**" : "**Avero wins this round.**";
  const symbols = { rock: "✊", paper: "✋", scissors: "✌️" };
  return gamePayload(createGamePanel({
    title: "Duel deck — rock, paper, scissors",
    description: "### " + symbols[playerChoice] + " You: " + LABELS[playerChoice] + "\n### " + symbols[botChoice] + " Avero: " + LABELS[botChoice] +
      "\n\n" + outcome + "\n\nChoose again for another round — this game is always free.",
    color: tie ? THEME.colors.primary : won ? THEME.colors.success : THEME.colors.warning,
    footer: "DUEL DECK • NO COINS INVOLVED",
    buttons: CHOICES.map((choice) => button(userId, "rps", LABELS[choice], choice, choice === playerChoice ? ButtonStyle.Primary : ButtonStyle.Secondary))
      .concat(navButtons(userId).slice(0, 1))
  }));
}
export function renderBuy(result, item, userId) {
  const success = result.purchased;
  const title = success ? "Item unlocked!" : result.reason === "owned" ? "Already in your collection" : "Not enough coins";
  const description = success
    ? "### " + item.icon + " " + item.name + "\nYou unlocked this collectible for **" + item.price + " coins**.\n\nWallet remaining: **" + result.account.balance.toLocaleString("en-US") + " coins**. Your collection is growing!"
    : result.reason === "owned" ? "You already own **" + item.name + "**. Your coins were not charged again."
      : "The **" + item.name + "** costs **" + item.price + " coins**. Your wallet has **" + result.account.balance.toLocaleString("en-US") + " coins**.\n\nEarn more with /daily or /guess.";
  return gamePayload(createGamePanel({
    title, description, color: success ? THEME.colors.success : THEME.colors.warning, footer: "SHOP • VIRTUAL COLLECTIBLES",
    buttons: [button(userId, "shop", "Back to shop", "", ButtonStyle.Primary, "🛍️"), button(userId, "inventory", "My collection", "", ButtonStyle.Secondary, "🎒"), button(userId, "balance", "Wallet", "", ButtonStyle.Secondary, "🪙")]
  }));
}
async function runGuess(prisma, guildId, userId, guess) {
  const answer = randomInt(1, 6);
  const result = guess === answer ? await awardGameReward(prisma, guildId, userId, WIN_REWARD, { type: "guess_win" }) : null;
  return renderGuess(guess, answer, result, userId);
}
async function runRps(playerChoice, userId) {
  return renderRps(playerChoice, CHOICES[randomInt(CHOICES.length)], userId);
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
  if (!prisma && parsed.action !== "rps") throw new Error("Game component requires a database client.");
  let payload;
  switch (parsed.action) {
    case "shop": payload = await renderShop(prisma, interaction.guildId, interaction.user.id); break;
    case "inventory": payload = await renderInventory(prisma, interaction.guildId, interaction.user.id); break;
    case "balance": payload = await renderBalance(prisma, interaction.guildId, interaction.user.id); break;
    case "daily":
      payload = renderDaily(await claimDailyReward(prisma, interaction.guildId, interaction.user.id, { amount: DAILY_REWARD, cooldownMs: DAILY_COOLDOWN_MS }), interaction.user.id);
      break;
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
      payload = await runRps(parsed.arg, interaction.user.id);
      break;
    default: return false;
  }
  await interaction.update({ components: payload.components });
  return true;
}
