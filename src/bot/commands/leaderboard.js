import { MessageFlags } from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";

const CATEGORIES = Object.freeze(["coins", "xp", "games"]);

export const leaderboardCommand = Object.freeze({
  data: Object.freeze({
    name: "leaderboard",
    description: "View the top members by coins, XP, or game record.",
    options: [{
      type: 3,
      name: "category",
      description: "Which leaderboard to show.",
      required: false,
      choices: [
        { name: "Coins", value: "coins" },
        { name: "XP", value: "xp" },
        { name: "Games", value: "games" }
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
      await interaction.reply({ content: "Choose coins, XP, or games.", flags: MessageFlags.Ephemeral });
      return;
    }

    let rows;
    if (category === "coins") {
      rows = await prisma.currencyAccount.findMany({ where: { guildId: interaction.guildId }, orderBy: { balance: "desc" }, take: 10 });
    } else if (category === "xp") {
      rows = await prisma.memberProfile.findMany({ where: { guildId: interaction.guildId }, orderBy: { xp: "desc" }, take: 10 });
    } else {
      const grouped = await prisma.currencyTransaction.groupBy({
        by: ["userId", "type"],
        where: { guildId: interaction.guildId, type: { in: ["guess_win_play", "guess_loss"] } },
        _count: { _all: true }
      });
      const scores = new Map();
      for (const row of grouped) {
        const current = scores.get(row.userId) ?? { userId: row.userId, wins: 0, losses: 0 };
        if (row.type === "guess_loss") current.losses += row._count._all;
        else current.wins += row._count._all;
        scores.set(row.userId, current);
      }
      rows = [...scores.values()]
        .map((row) => ({ ...row, gamesPlayed: row.wins + row.losses }))
        .sort((a, b) => b.wins - a.wins || b.gamesPlayed - a.gamesPlayed || a.userId.localeCompare(b.userId))
        .slice(0, 10);
    }

    const description = rows.length
      ? rows.map((row, index) => {
          let score;
          if (category === "coins") score = row.balance.toLocaleString("en-US") + " coins";
          else if (category === "xp") score = row.xp.toLocaleString("en-US") + " XP";
          else score = row.wins + "W / " + row.losses + "L · " + (row.gamesPlayed ? Math.round(row.wins / row.gamesPlayed * 100) : 0) + "% win rate";
          const medal = ["🥇", "🥈", "🥉"][index] ?? "`#" + (index + 1) + "`";
          return medal + "  <@" + row.userId + "> — **" + score + "**";
        }).join("\n")
      : "No scores yet. Start playing to get on the board.";

    await interaction.reply({
      embeds: [createEmbed({
        title: category === "coins" ? "🪙 Coin leaderboard" : category === "xp" ? "🏅 XP leaderboard" : "🎮 Games leaderboard",
        description,
        color: THEME.colors.primary,
      })]
    });
  }
});
