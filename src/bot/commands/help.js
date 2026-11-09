import { createGamePanel, gamePayload } from "../game-ui.js";
import { getServerEmoji } from "../../../averoui/server-emojis.js";

export const helpCommand = Object.freeze({
  data: Object.freeze({ name: "help", description: "Find your way around Avero." }),
  async execute(interaction) {
    await interaction.reply(gamePayload(createGamePanel({
      title: "Avero commands",
      eyebrow: "QUICK GUIDE",
      description: "Coins, games, collectibles and server tools. Pick a command and jump in.",
      sections: [
        "**" + getServerEmoji("coin", "🪙") + " Coins & collectibles**\n/balance · Wallet\n/daily · Daily coins\n/contracts · Daily goals + bonus coins\n/collections · Three themed sets\n/shop · Browse collectibles\n/buy · Unlock an item\n/inventory · Your collection\n/work · Earn coins every 60 min\n/scavenge · Explore a route\n/perks · Role perks",
        "**" + getServerEmoji("game", "🎮") + " Quick games**\n/games · Quick-play menu\n/coinflip · Heads or tails, free play\n/guess · Guess 1–5, free play\n/rps · Rock, paper, scissors\n/vault · Daily puzzle, free play\nAll free games · no wagers",
        "**" + getServerEmoji("profile", "🏅") + " Your profile**\n/profile · Wallet, stats and collection\n/rep profile · Reputation and history\n+rep @member · Give positive reputation\n-rep @member reason · Give negative reputation\n/achievements · Milestones\n/titles · Unlock and equip titles\n",
        "**" + getServerEmoji("settings", "🛠️") + " Server tools**\n/setup · Check server setup\n/config · Server settings (Manage Server)\n/autoresponder · Automatic responses, message milestones and logs (Manage Server)\n/ping · Bot latency"
      ],
      footer: "AVERO • COMMAND GUIDE",
      separators: true
    })));
  }
});
