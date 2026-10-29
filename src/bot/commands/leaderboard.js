import { MessageFlags } from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";

const CATEGORIES = Object.freeze(["coins", "xp"]);

export const leaderboardCommand = Object.freeze({
  data: Object.freeze({
    name: "leaderboard",
    description: "View the top members by coins or XP.",
    options: [{
      type: 3,
      name: "category",
      description: "Which leaderboard to show.",
      required: false,
      choices: [
        { name: "Coins", value: "coins" },
        { name: "XP", value: "xp" }
      ]
    }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Leaderboard command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Leaderboards are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const category = interaction.options.getString("category") ?? "coins";
    if (!CATEGORIES.includes(category)) {
      await interaction.reply({ content: "Choose coins or XP.", flags: MessageFlags.Ephemeral });
      return;
    }

    const rows = category === "coins"
      ? await prisma.currencyAccount.findMany({ where: { guildId: interaction.guildId }, orderBy: { balance: "desc" }, take: 10 })
      : await prisma.memberProfile.findMany({ where: { guildId: interaction.guildId }, orderBy: { xp: "desc" }, take: 10 });

    const description = rows.length
      ? rows.map((row, index) => {
          const score = category === "coins" ? row.balance.toLocaleString("en-US") + " coins" : row.xp.toLocaleString("en-US") + " XP";
          const medal = ["🥇", "🥈", "🥉"][index] ?? "`#" + (index + 1) + "`";
          return medal + "  <@" + row.userId + "> — **" + score + "**";
        }).join("\n")
      : "No scores yet. Start playing to get on the board.";

    await interaction.reply({
      embeds: [createEmbed({
        title: category === "coins" ? "🪙 Coin leaderboard" : "🏅 XP leaderboard",
        description,
        color: THEME.colors.primary,
      })]
    });
  }
});
