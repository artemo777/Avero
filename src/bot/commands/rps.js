import { randomInt } from "node:crypto";
import { MessageFlags } from "discord.js";
import { renderRps } from "../game-ui.js";

const CHOICES = Object.freeze(["rock", "paper", "scissors"]);

export const rpsCommand = Object.freeze({
  data: Object.freeze({
    name: "rps",
    description: "Play rock, paper, scissors against Avero. Completely free!",
    options: [{
      type: 3,
      name: "choice",
      description: "Choose rock, paper, or scissors.",
      required: true,
      choices: [{ name: "Rock", value: "rock" }, { name: "Paper", value: "paper" }, { name: "Scissors", value: "scissors" }]
    }]
  }),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Games can only be played inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const playerChoice = interaction.options.getString("choice", true);
    if (!CHOICES.includes(playerChoice)) {
      await interaction.reply({ content: "Choose rock, paper, or scissors.", flags: MessageFlags.Ephemeral });
      return;
    }
    const botChoice = CHOICES[randomInt(CHOICES.length)];
    await interaction.reply(renderRps(playerChoice, botChoice, interaction.user.id));
  }
});
