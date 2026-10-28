import { createEmbed, THEME } from "../../../averoui/index.js";

export const helpCommand = Object.freeze({
  data: Object.freeze({
    name: "help",
    description: "Browse Avero commands by category."
  }),
  async execute(interaction) {
    await interaction.reply({
      embeds: [createEmbed({
        title: "Avero commands",
        description: "Coins, games, collectibles, and levels. Pick a command from Discord's slash menu.",
        color: THEME.colors.primary,
        fields: [
          { name: "🪙 Economy", value: "`/balance` Wallet\n`/daily` Daily coins\n`/shop` Browse collectibles\n`/buy` Unlock an item\n`/inventory` Your collection" },
          { name: "🎮 Games", value: "`/games` Quick-play menu\n`/guess` Guess 1–5\n`/rps` Rock, paper, scissors" },
          { name: "🏅 Profile & ranks", value: "`/profile` Member stats\n`/leaderboard` Top coins or XP\n`/rank` Level and XP" },
          { name: "🛠️ Utility", value: "`/help` This menu\n`/ping` Bot latency" }
        ],
        footer: "AVERO • COMMAND GUIDE"
      })]
    });
  }
});
