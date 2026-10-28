import { randomInt } from "node:crypto";
import { MessageFlags } from "discord.js";
import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";

const CHOICES = Object.freeze(["rock", "paper", "scissors"]);
const BEATS = Object.freeze({
  rock: "scissors",
  paper: "rock",
  scissors: "paper"
});
const LABELS = Object.freeze({
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors"
});

export const rpsCommand = Object.freeze({
  data: Object.freeze({
    name: "rps",
    description: "Play rock, paper, scissors against Avero. Completely free!",
    options: [{
      type: 3,
      name: "choice",
      description: "Choose rock, paper, or scissors.",
      required: true,
      choices: CHOICES.map((choice) => ({ name: LABELS[choice], value: choice }))
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
    const outcome = playerChoice === botChoice
      ? "It's a tie!"
      : BEATS[playerChoice] === botChoice
        ? "You win this round!"
        : "Avero wins this round.";

    await interaction.reply({
      embeds: [createEmbed({
        title: "✦  AVERO // DUEL DECK",
        description: "**YOU**\n" + LABELS[playerChoice] + "\n\n**AVERO**\n" + LABELS[botChoice] + "\n\n" + outcome,
        color: playerChoice === botChoice ? THEME.colors.primary :
          BEATS[playerChoice] === botChoice ? THEME.colors.success : THEME.colors.warning,
        footer: "AVERO • FREE TO PLAY, NO COINS INVOLVED"
      })]
    });
  }
});
