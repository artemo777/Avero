import { createEmbed, THEME } from "../../../averoui/index.js";

export const helpCommand = Object.freeze({
  data: Object.freeze({
    name: "help",
    description: "Find your way around Avero."
  }),
  async execute(interaction) {
    await interaction.reply({
      embeds: [createEmbed({
        title: "Avero commands",
        description: "Coins, games, collectibles and server tools. Pick a command and jump in.",
        color: THEME.colors.primary,
        fields: [
          { name: "🪙 Coins & collectibles", value: "/balance Wallet\n/daily Daily coins\n/contracts Daily goals + bonus coins\n/collections Three themed sets and cosmetic titles\n/shop Browse collectibles\n/buy Unlock an item\n/inventory Your collection\n/work Earn coins every 30 min\n/scavenge Choose Archive, Plaza or Garden\n/perks Booster, Funder and Voter perks" },
          { name: "🎮 Quick games", value: "/games Quick-play menu\n/coinflip Heads or tails · free, +25 coins on a win every 10m\n/guess Guess 1–5 · free, 10m reward cooldown\n/rps Rock, paper, scissors · free, +25 coins on a win every 10m\n/vault View daily clues or submit one code · free, one attempt per UTC day; +25 for a correct solve" },
          { name: "🏅 Your profile", value: "/profile Wallet, game stats, collection and equipped badge\n/achievements Milestones and collection progress\n/titles Unlock, buy and equip profile titles\n/leaderboard Coins, games, coinflip, guess, RPS or Vault" },
          { name: "🛠️ Server tools", value: "/setup Check server setup and permissions\n/config Server settings (Manage Server)\n/help This menu\n/ping Check bot latency" }
        ],
      })]
    });
  }
});
