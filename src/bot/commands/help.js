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
        "**" + getServerEmoji("coin", "🪙") + " Coins & collectibles**\n/balance · Wallet\n" + getServerEmoji("daily", "✨") + " /daily · Daily coins\n" + getServerEmoji("contracts", "📜") + " /contracts · Daily goals + bonus coins\n" + getServerEmoji("collections", "🗺️") + " /collections · Three themed sets\n" + getServerEmoji("shop", "🛍️") + " /shop · Browse collectibles\n" + getServerEmoji("unlock", "🔓") + " /buy · Unlock an item\n" + getServerEmoji("inventory", "🎒") + " /inventory · Your collection\n" + getServerEmoji("work", "🧰") + " /work · Earn coins every 60 min\n" + getServerEmoji("scavenge", "🧭") + " /scavenge · Explore a route\n" + getServerEmoji("vip", "⭐") + " /perks · Role perks",
        "**" + getServerEmoji("game", "🎮") + " Quick games**\n/games · Quick-play menu\n/coinflip · Heads or tails, free play\n/guess · Guess 1–5, free play\n/rps · Rock, paper, scissors\n" + getServerEmoji("vault", "🔐") + " /vault · Daily puzzle, free play\nAll free games · no wagers",
        "**" + getServerEmoji("profile", "🏅") + " Your profile**\n/profile · Wallet, stats and collection\n/rep profile · Reputation and history\n+rep @member · Give positive reputation\n-rep @member reason · Give negative reputation\n" + getServerEmoji("crown", "🏆") + " /achievements · Milestones\n/titles · Unlock and equip titles\n",
        "**" + getServerEmoji("staff-member", "🛡️") + " Server tools**\n/setup · Check server setup\n/config · Server settings (Manage Server)\n/autoresponder · Automatic responses, message milestones and logs (Manage Server)\n" + getServerEmoji("support", "🛟") + " Support · Use Avero support link\n/ping · Bot latency"
      ],
      footer: "AVERO • COMMAND GUIDE",
      separators: true
    })));
  }
});
