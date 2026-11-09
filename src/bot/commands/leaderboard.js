import { MessageFlags } from "discord.js";
import { createGamePanel, gamePayload } from "../game-ui.js";


const GLOBAL_SCOPE_ID = "__avero_global__";
const CATEGORIES = Object.freeze(["coins", "games", "coinflip", "guess", "rps", "vault", "xp", "messages", "voice", "engauge-currency"]);
const number = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const fmt = (value) => Math.floor(number(value)).toLocaleString("en-US");

export const leaderboardCommand = Object.freeze({
  data: Object.freeze({
    name: "leaderboard",
    description: "See Avero game, coin, and server progression rankings.",
    options: [{
      type: 3,
      name: "category",
      description: "Which leaderboard to show.",
      required: false,
      choices: [
        { name: "Avero Coins", value: "coins" },
        { name: "Games", value: "games" },
        { name: "Coinflip", value: "coinflip" },
        { name: "Guess", value: "guess" },
        { name: "Rock, Paper, Scissors", value: "rps" },
        { name: "The Vault", value: "vault" },
        { name: "Avero XP", value: "xp" },
        { name: "Avero Messages", value: "messages" },
        { name: "Avero Voice Time", value: "voice" },
        { name: "Imported Server Currency", value: "engauge-currency" }
      ]
    }]
  }),
  async execute(interaction, { prisma, engaugeClient = engauge } = {}) {
    if (!prisma) throw new Error("Leaderboard command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Leaderboards are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const category = interaction.options.getString("category") ?? "coins";
    if (!CATEGORIES.includes(category)) {
      await interaction.reply({ content: "Choose an Avero or Engauge leaderboard category.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (["xp", "messages", "voice", "engauge-currency"].includes(category)) {
      const orderBy = category === "xp" ? [{ totalXp: "desc" }, { level: "desc" }]
        : category === "messages" ? [{ messages: "desc" }]
          : category === "voice" ? [{ voiceSeconds: "desc" }]
            : [{ currency: "desc" }];
      const members = await prisma.guildMemberProgress.findMany({
        where: { guildId: interaction.guildId },
        orderBy,
        take: 10
      });
      const rows = members.map((member) => ({
        userId: member.userId,
        score: category === "xp" ? fmt(member.totalXp)
          : category === "messages" ? fmt(member.messages)
            : category === "voice" ? fmt(number(member.voiceSeconds) / 60)
              : fmt(member.currency)
      }));
      const label = category === "xp" ? "total XP" : category === "messages" ? "messages"
        : category === "voice" ? "voice minutes" : "imported currency";
      const description = rows.length
        ? rows.map((row, index) => {
            const medal = ["🥇", "🥈", "🥉"][index] ?? "`#" + (index + 1) + "`";
            return medal + "  <@" + row.userId + "> — **" + row.score + " " + label + "**";
          }).join("\n")
        : "No Avero progression records yet. Members will appear as they earn XP.";
      const title = category === "xp" ? "Avero XP leaderboard"
        : category === "messages" ? "Avero message leaderboard"
          : category === "voice" ? "Avero voice leaderboard" : "Imported currency leaderboard";
      await interaction.reply({
        ...gamePayload(createGamePanel({
          title,
          eyebrow: "AVERO SERVER DATA",
          description,
          footer: "TOP 10 • STORED IN AVERO"
        })),
        allowedMentions: { parse: [] }
      });
      return;
    }

    let rows;
    if (category === "coins") {
      rows = await prisma.currencyAccount.findMany({ where: { guildId: GLOBAL_SCOPE_ID }, orderBy: { balance: "desc" }, take: 10 });
    } else {
      const gameTypes = category === "guess"
        ? ["guess_win_play", "guess_win", "guess_loss"]
        : category === "rps"
          ? ["rps_win", "rps_loss", "rps_tie"]
          : category === "vault"
            ? ["vault_win", "vault_loss"]
            : category === "coinflip"
              ? ["coinflip_win", "coinflip_loss"]
              : ["guess_win_play", "guess_win", "guess_loss", "rps_win", "rps_loss", "rps_tie", "vault_win", "vault_loss", "coinflip_win", "coinflip_loss"];
      const grouped = await prisma.currencyTransaction.groupBy({
        by: ["userId", "type"],
        where: { guildId: GLOBAL_SCOPE_ID, type: { in: gameTypes } },
        _count: { _all: true }
      });
      const scores = new Map();
      for (const row of grouped) {
        const current = scores.get(row.userId) ?? {
          userId: row.userId, guessWins: 0, legacyGuessWins: 0, rpsWins: 0, vaultWins: 0, coinflipWins: 0, losses: 0, ties: 0
        };
        if (row.type === "guess_win_play") current.guessWins += row._count._all;
        else if (row.type === "guess_win") current.legacyGuessWins += row._count._all;
        else if (row.type === "guess_loss" || row.type === "rps_loss" || row.type === "vault_loss" || row.type === "coinflip_loss") current.losses += row._count._all;
        else if (row.type === "rps_tie") current.ties += row._count._all;
        else if (row.type === "rps_win") current.rpsWins += row._count._all;
        else if (row.type === "vault_win") current.vaultWins += row._count._all;
        else if (row.type === "coinflip_win") current.coinflipWins += row._count._all;
        scores.set(row.userId, current);
      }
      rows = [...scores.values()]
        .map((row) => {
          const guessWins = row.guessWins + row.legacyGuessWins;
          const wins = category === "guess" ? guessWins : category === "rps" ? row.rpsWins : category === "vault" ? row.vaultWins : category === "coinflip" ? row.coinflipWins : guessWins + row.rpsWins + row.vaultWins + row.coinflipWins;
          return { ...row, wins, gamesPlayed: wins + row.losses + row.ties };
        })
        .sort((a, b) => b.wins - a.wins || b.gamesPlayed - a.gamesPlayed || a.userId.localeCompare(b.userId))
        .slice(0, 10);
    }

    const description = rows.length
      ? rows.map((row, index) => {
          let score;
          if (category === "coins") score = row.balance.toLocaleString("en-US") + " coins";
          else { const record = row.wins + "W / " + row.losses + "L" + (category === "guess" || category === "vault" || category === "coinflip" ? "" : " / " + row.ties + "T"); score = record + " · " + (row.gamesPlayed ? Math.round(row.wins / row.gamesPlayed * 100) : 0) + "% win rate"; }
          const medal = ["🥇", "🥈", "🥉"][index] ?? "`#" + (index + 1) + "`";
          return medal + "  <@" + row.userId + "> — **" + score + "**";
        }).join("\n")
      : "No scores yet. Start playing to get on the board.";

    const title = category === "coins" ? "Coin leaderboard" : category === "guess" ? "Guess leaderboard" : category === "rps" ? "Rock-paper-scissors leaderboard" : category === "vault" ? "Vault leaderboard" : category === "coinflip" ? "Coinflip leaderboard" : "Games leaderboard";
    await interaction.reply({
      ...gamePayload(createGamePanel({
        title,
        eyebrow: "GLOBAL RANKINGS",
        description,
        footer: "TOP 10 • GLOBAL STATS",
        separators: true
      })),
      allowedMentions: { parse: [] }
    });
  }
});
