import { MessageFlags } from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";

const CATEGORIES = Object.freeze(["coins", "xp", "games", "guess", "rps"]);

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
        { name: "Games", value: "games" },
        { name: "Guess", value: "guess" },
        { name: "Rock, Paper, Scissors", value: "rps" }
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
      await interaction.reply({ content: "Choose coins, XP, games, guess, or RPS.", flags: MessageFlags.Ephemeral });
      return;
    }

    let rows;
    if (category === "coins") {
      rows = await prisma.currencyAccount.findMany({ where: { guildId: interaction.guildId }, orderBy: { balance: "desc" }, take: 10 });
    } else if (category === "xp") {
      rows = await prisma.memberProfile.findMany({ where: { guildId: interaction.guildId }, orderBy: { xp: "desc" }, take: 10 });
    } else {
      const gameTypes = category === "guess"
        ? ["guess_win_play", "guess_win", "guess_loss"]
        : category === "rps"
          ? ["rps_win", "rps_loss", "rps_tie"]
          : ["guess_win_play", "guess_win", "guess_loss", "rps_win", "rps_loss", "rps_tie"];
      const grouped = await prisma.currencyTransaction.groupBy({
        by: ["userId", "type"],
        where: { guildId: interaction.guildId, type: { in: gameTypes } },
        _count: { _all: true }
      });
      const scores = new Map();
      for (const row of grouped) {
        const current = scores.get(row.userId) ?? {
          userId: row.userId, guessWins: 0, legacyGuessWins: 0, rpsWins: 0, losses: 0, ties: 0
        };
        if (row.type === "guess_win_play") current.guessWins += row._count._all;
        else if (row.type === "guess_win") current.legacyGuessWins += row._count._all;
        else if (row.type === "guess_loss" || row.type === "rps_loss") current.losses += row._count._all;
        else if (row.type === "rps_tie") current.ties += row._count._all;
        else if (row.type === "rps_win") current.rpsWins += row._count._all;
        scores.set(row.userId, current);
      }
      rows = [...scores.values()]
        .map((row) => {
          const guessWins = Math.max(row.guessWins, row.legacyGuessWins);
          const wins = guessWins + row.rpsWins;
          return { ...row, wins, gamesPlayed: wins + row.losses + row.ties };
        })
        .sort((a, b) => b.wins - a.wins || b.gamesPlayed - a.gamesPlayed || a.userId.localeCompare(b.userId))
        .slice(0, 10);
    }

    const description = rows.length
      ? rows.map((row, index) => {
          let score;
          if (category === "coins") score = row.balance.toLocaleString("en-US") + " coins";
          else if (category === "xp") score = row.xp.toLocaleString("en-US") + " XP";
          else { const record = row.wins + "W / " + row.losses + "L" + (category === "guess" ? "" : " / " + row.ties + "T"); score = record + " · " + (row.gamesPlayed ? Math.round(row.wins / row.gamesPlayed * 100) : 0) + "% win rate"; }
          const medal = ["🥇", "🥈", "🥉"][index] ?? "`#" + (index + 1) + "`";
          return medal + "  <@" + row.userId + "> — **" + score + "**";
        }).join("\n")
      : "No scores yet. Start playing to get on the board.";

    await interaction.reply({
      embeds: [createEmbed({
        title: category === "coins" ? "🪙 Coin leaderboard" : category === "xp" ? "🏅 XP leaderboard" : category === "guess" ? "🎯 Guess leaderboard" : category === "rps" ? "✊ Rock-paper-scissors leaderboard" : "🎮 Games leaderboard",
        description,
        color: THEME.colors.primary,
      })]
    });
  }
});
