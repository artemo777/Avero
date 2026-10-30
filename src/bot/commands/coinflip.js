import { randomInt } from "node:crypto";
import { MessageFlags } from "discord.js";
import { awardGameReward, recordGameResult } from "../../db/currency-repository.js";
import { createGamePanel, gamePayload } from "../game-ui.js";
import { GUESS_REWARD, GUESS_REWARD_COOLDOWN_MS } from "../economy-rules.js";

const SIDES = Object.freeze(["heads", "tails"]);

export const coinflipCommand = Object.freeze({
  data: Object.freeze({
    name: "coinflip",
    description: "Call heads or tails. Free to play; a win can earn 25 coins every 10 minutes.",
    options: [{
      type: 3,
      name: "call",
      description: "Choose heads or tails.",
      required: true,
      choices: [{ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" }]
    }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Coinflip is available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const call = interaction.options.getString("call", true);
    if (!SIDES.includes(call)) {
      await interaction.reply({ content: "Choose heads or tails.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!prisma) throw new Error("Coinflip requires a database client.");

    const result = randomInt(2) === 0 ? "heads" : "tails";
    const won = call === result;
    await recordGameResult(prisma, interaction.guildId, interaction.user.id, "coinflip", won ? "win" : "loss");
    const reward = won
      ? await awardGameReward(prisma, interaction.guildId, interaction.user.id, GUESS_REWARD, {
          type: "coinflip_reward",
          cooldownMs: GUESS_REWARD_COOLDOWN_MS
        })
      : null;
    const outcome = won
      ? reward.awarded
        ? "🎉 **You won · +" + reward.amount + " coins**\nBalance: **" + reward.account.balance.toLocaleString("en-US") + " coins**"
        : "🎉 **You won!**\nYour shared game-reward cooldown is active, so no coins were added."
      : "Not this time — no coins were lost. Try again whenever you like.";
    const panel = createGamePanel({
      title: won ? "A clean call!" : "The coin landed",
      eyebrow: "COINFLIP",
      description: "Free play · no wagers · virtual coins only\n\nYou called **" + call.toUpperCase() + "**\nAvero flipped **" + result.toUpperCase() + "**\n\n" + outcome,
      footer: "FREE PLAY • NO WAGERS • VIRTUAL COINS ONLY"
    });
    await interaction.reply(gamePayload(panel));
  }
});
