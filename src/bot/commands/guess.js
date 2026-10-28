import { randomInt } from "node:crypto";
import { MessageFlags } from "discord.js";
import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";
import { awardGameReward } from "../../db/currency-repository.js";

const MIN_GUESS = 1;
const MAX_GUESS = 5;
const WIN_REWARD = 25;

export const guessCommand = Object.freeze({
  data: Object.freeze({
    name: "guess",
    description: "Guess the number from 1 to 5 to win 25 coins. No coins required to play.",
    options: [{
      type: 4,
      name: "number",
      description: "Your guess (1–5).",
      required: true,
      min_value: MIN_GUESS,
      max_value: MAX_GUESS
    }]
  }),

  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Guess command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Guess can only be played inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const guess = interaction.options.getInteger("number", true);
    if (!Number.isSafeInteger(guess) || guess < MIN_GUESS || guess > MAX_GUESS) {
      await interaction.reply({ content: "Choose a whole number from 1 to 5.", flags: MessageFlags.Ephemeral });
      return;
    }

    const answer = randomInt(MIN_GUESS, MAX_GUESS + 1);
    if (guess !== answer) {
      await interaction.reply({
        embeds: [createEmbed({
          title: "◈  NOT THIS TIME",
          description: "The number was **" + answer + "**. Try again — playing is free, and you never lose coins.",
          color: THEME.colors.primary,
          footer: "AVERO • THE NUMBER GAME"
        })]
      });
      return;
    }

    const result = await awardGameReward(prisma, interaction.guildId, interaction.user.id, WIN_REWARD, {
      type: "guess_win"
    });
    await interaction.reply({
      embeds: [createEmbed({
        title: "✦  PERFECT GUESS",
        description: "The number was **" + answer + "**. You earned **+" + WIN_REWARD +
          " coins**! Your new balance is **" + result.account.balance.toLocaleString("en-US") + " coins**.\n\nYour next collectible is getting closer.",
        color: THEME.colors.success,
        footer: "AVERO • NO WAGER REQUIRED"
      })]
    });
  }
});
