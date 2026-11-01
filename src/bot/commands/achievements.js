import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { createGamePanel, gamePayload } from "../game-ui.js";
import { getCurrencyPurchases, getCurrencyStats } from "../../db/currency-repository.js";
import { SHOP_ITEMS } from "../shop-catalog.js";
import { buildCollectionSetProgress } from "../collection-sets.js";

function buildAchievements(stats, ownedCount, collectionSets) {
  return [
    { name: "First Shift", description: "Complete your first work shift.", progress: stats.workShifts, target: 1 },
    { name: "Field Finder", description: "Complete your first scavenging run.", progress: stats.scavenges, target: 1 },
    { name: "Game Regular", description: "Play 10 recorded game rounds.", progress: stats.gamesPlayed, target: 10 },
    { name: "Duelist", description: "Win 5 free game rounds.", progress: stats.gameWins, target: 5 },
    { name: "First Collectible", description: "Add your first collectible to the collection.", progress: ownedCount, target: 1 },
    { name: "Curator", description: "Collect 3 different items.", progress: ownedCount, target: 3 },
    { name: "Full Set", description: "Collect every item in the current shop.", progress: ownedCount, target: SHOP_ITEMS.length },
    { name: "Coin Maker", description: "Earn 1,000 virtual coins over time.", progress: stats.lifetimeEarned, target: 1000 },
    { name: "Big Spender", description: "Spend 1,000 virtual coins on collectibles.", progress: stats.lifetimeSpent, target: 1000 },
    { name: "Archive Keeper", description: "Complete The Archive Protocol set.", progress: Number(collectionSets.find((set) => set.id === "archive-protocol")?.complete ?? false), target: 1 },
    { name: "Circuit Breaker", description: "Complete the Neon Circuit set.", progress: Number(collectionSets.find((set) => set.id === "neon-circuit")?.complete ?? false), target: 1 },
    { name: "Moonlit Curator", description: "Complete the Moonlit Relics set.", progress: Number(collectionSets.find((set) => set.id === "moonlit-relics")?.complete ?? false), target: 1 }
  ];
}

export async function renderAchievementsPage(prisma, guildId, target, controlUserId, page = 0) {
  const [stats, purchases] = await Promise.all([
    getCurrencyStats(prisma, guildId, target.id),
    getCurrencyPurchases(prisma, guildId, target.id)
  ]);
  const ownedCount = new Set(purchases.map((purchase) => purchase.itemId)).size;
  const collectionSets = buildCollectionSetProgress(purchases.map((purchase) => purchase.itemId));
  const achievements = buildAchievements(stats, ownedCount, collectionSets);
  const unlocked = achievements.filter((achievement) => achievement.progress >= achievement.target).length;
  const pageSize = 7;
  const pageCount = Math.max(1, Math.ceil(achievements.length / pageSize));
  const currentPage = Math.min(Math.max(Number.isInteger(page) ? page : 0, 0), pageCount - 1);
  const pageItems = achievements.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const sections = pageItems.map((achievement) => {
    const complete = achievement.progress >= achievement.target;
    const progress = Math.min(achievement.progress, achievement.target);
    return (complete ? "✓ " : "◇ ") + "**" + achievement.name + "**\n" + achievement.description + "\n" +
      (complete ? "**Unlocked**" : "**Progress:** " + progress.toLocaleString("en-US") + " / " + achievement.target.toLocaleString("en-US"));
  });
  const buttons = pageCount > 1 ? [
    { customId: "avero|" + controlUserId + "|achievements_page|" + target.id + ":" + Math.max(0, currentPage - 1), label: "← Previous", disabled: currentPage === 0 },
    { customId: "avero|" + controlUserId + "|achievements_page|" + target.id + ":" + Math.min(pageCount - 1, currentPage + 1), label: "Next →", disabled: currentPage === pageCount - 1 }
  ] : [];
  return {
    ...gamePayload(createGamePanel({
      title: target.username + "'s achievements",
      eyebrow: "MILESTONES",
      description: "**" + unlocked + " / " + achievements.length + " unlocked** · Server milestones\\nCosmetic progress only · virtual coins have no cash value.",
      sections,
      buttons,
      color: unlocked === achievements.length ? 0x2DD4BF : undefined,
      footer: "AVERO ACHIEVEMENTS • SERVER-SCOPED PROGRESS",
      separators: true
    })),
    allowedMentions: { parse: [] }
  };
}

export const achievementsCommand = Object.freeze({
  data: Object.freeze({
    name: "achievements",
    description: "Check your milestones and collection progress.",
    options: [{
      type: 6,
      name: "member",
      description: "Member whose achievements you want to view.",
      required: false
    }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Achievements command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Achievements are available inside a server.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const target = interaction.options.getUser("member") ?? interaction.user;
    await interaction.reply(await renderAchievementsPage(prisma, interaction.guildId, target, interaction.user.id));
  }
});
