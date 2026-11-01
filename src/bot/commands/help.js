import { createGamePanel, gamePayload } from "../game-ui.js";

export const helpCommand = Object.freeze({
  data: Object.freeze({ name: "help", description: "Find your way around Avero." }),
  async execute(interaction) {
    await interaction.reply(gamePayload(createGamePanel({
      title: "Avero commands",
      eyebrow: "QUICK GUIDE",
      description: "Coins, games, collectibles and server tools. Pick a command and jump in.",
      sections: [
        "**🪙 Coins & collectibles**\n/balance · Wallet\n/daily · Daily coins\n/contracts · Daily goals + bonus coins\n/collections · Three themed sets\n/shop · Browse collectibles\n/buy · Unlock an item\n/inventory · Your collection\n/work · Earn coins every 30 min\n/scavenge · Explore a route\n/perks · Role perks",
        "**🎮 Quick games**\n/games · Quick-play menu\n/coinflip · Heads or tails, free play\n/guess · Guess 1–5, free play\n/rps · Rock, paper, scissors\n/vault · Daily puzzle, free play\nAll free games · no wagers",
        "**🏅 Your profile**\n/profile · Wallet, stats and collection\n/achievements · Milestones\n/titles · Unlock and equip titles\n/leaderboard · Global rankings",
        "**🛠️ Server tools**\n/setup · Check server setup\n/config · Server settings (Manage Server)\n/ping · Bot latency"
      ],
      footer: "AVERO • COMMAND GUIDE",
      separators: true
    })));
  }
});
