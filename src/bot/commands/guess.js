import { randomInt } from "node:crypto";
import { MessageFlags } from "discord.js";
import { awardGameReward, recordGuessResult } from "../../db/currency-repository.js";
import { renderGuess } from "../game-ui.js";

const MIN_GUESS = 1;
const MAX_GUESS = 5;
const WIN_REWARD = 25;

export const guessCommand = Object.freeze({
  data: Object.freeze({
    name: "guess",
    description: "Guess 1–5 to win 25 coins. Free to play, no wagers.",
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
    const won = guess === answer;
    await recordGuessResult(prisma, interaction.guildId, interaction.user.id, won);
    const result = won
      ? await awardGameReward(prisma, interaction.guildId, interaction.user.id, WIN_REWARD, { type: "guess_reward", cooldownMs: 60_000 })
      : null;
    await interaction.reply(renderGuess(guess, answer, result, interaction.user.id));
  }
});
