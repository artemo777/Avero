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
          { name: "🪙 Economy", value: "/balance Wallet\n/daily Daily coins\n/contracts Daily goals and bonus rewards\n/shop Browse collectibles\n/buy Unlock an item\n/inventory Your collection\n/work Earn coins every 30m\n/scavenge Search for coins and collectible drops" },
          { name: "🎮 Games", value: "/games Quick-play menu\n/guess Guess 1–5 · free, 10m reward cooldown\n/rps Rock, paper, scissors · free, +25 coins on a win every 10m\n/vault Daily three-dial puzzle · free, +25 coins on a win every 10m" },
          { name: "🏅 Profile & ranks", value: "/profile Wallet, stats and equipped badge\n/achievements Earned milestones and collection progress\n/leaderboard Coins, XP, games, guess, RPS or Vault\n/rank Level and XP" },
          { name: "🛠️ Utility", value: "/help This menu\n/ping Bot latency" }
        ],
      })]
    });
  }
});
