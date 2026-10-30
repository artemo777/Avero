import { MessageFlags } from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";
import { getCurrencyPurchases, getCurrencyStats } from "../../db/currency-repository.js";
import { SHOP_ITEMS } from "../shop-catalog.js";

function buildAchievements(stats, ownedCount) {
  return [
    { name: "First Shift", description: "Complete your first work shift.", progress: stats.workShifts, target: 1 },
    { name: "Field Finder", description: "Complete your first scavenging run.", progress: stats.scavenges, target: 1 },
    { name: "Game Regular", description: "Play 10 recorded game rounds.", progress: stats.gamesPlayed, target: 10 },
    { name: "Duelist", description: "Win 5 free game rounds.", progress: stats.gameWins, target: 5 },
    { name: "First Collectible", description: "Add your first collectible to the collection.", progress: ownedCount, target: 1 },
    { name: "Curator", description: "Collect 3 different items.", progress: ownedCount, target: 3 },
    { name: "Full Set", description: "Collect every item in the current shop.", progress: ownedCount, target: SHOP_ITEMS.length },
    { name: "Coin Maker", description: "Earn 1,000 virtual coins over time.", progress: stats.lifetimeEarned, target: 1000 },
    { name: "Big Spender", description: "Spend 1,000 virtual coins on collectibles.", progress: stats.lifetimeSpent, target: 1000 }
  ];
}

export const achievementsCommand = Object.freeze({
  data: Object.freeze({
    name: "achievements",
    description: "View earned Avero milestones and collection progress.",
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
    const [stats, purchases] = await Promise.all([
      getCurrencyStats(prisma, interaction.guildId, target.id),
      getCurrencyPurchases(prisma, interaction.guildId, target.id)
    ]);
    const ownedCount = new Set(purchases.map((purchase) => purchase.itemId)).size;
    const achievements = buildAchievements(stats, ownedCount);
    const unlocked = achievements.filter((achievement) => achievement.progress >= achievement.target).length;
    const fields = achievements.map((achievement) => {
      const complete = achievement.progress >= achievement.target;
      const progress = Math.min(achievement.progress, achievement.target);
      return {
        name: (complete ? "✓ " : "◇ ") + achievement.name,
        value: achievement.description + "\n" +
          (complete ? "**Unlocked**" : "**Progress:** " + progress.toLocaleString("en-US") + " / " + achievement.target.toLocaleString("en-US"))
      };
    });

    await interaction.reply({
      allowedMentions: { parse: [] },
      embeds: [createEmbed({
        title: "🏆 " + target.username + "'s achievements",
        description: "**" + unlocked + " / " + achievements.length + " unlocked** · Server milestones\nCosmetic progress only · virtual coins have no cash value.",
        color: unlocked === achievements.length ? THEME.colors.success : THEME.colors.primary,
        fields,
        footer: "Avero achievements • progress is saved per server"
      })]
    });
  }
});
