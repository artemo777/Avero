import { MessageFlags } from "discord.js";
import { runRps } from "../game-ui.js";


export const rpsCommand = Object.freeze({
  data: Object.freeze({
    name: "rps",
    description: "Play rock, paper, scissors for free. Wins can earn 25 coins every 10 minutes.",
    options: [{
      type: 3,
      name: "choice",
      description: "Choose rock, paper, or scissors.",
      required: true,
      choices: [{ name: "Rock", value: "rock" }, { name: "Paper", value: "paper" }, { name: "Scissors", value: "scissors" }]
    }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Games can only be played inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const playerChoice = interaction.options.getString("choice", true);
    if (!CHOICES.includes(playerChoice)) {
      await interaction.reply({ content: "Choose rock, paper, or scissors.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!prisma) throw new Error("Rock-paper-scissors requires a database client.");
    await interaction.reply(await runRps(prisma, interaction.guildId, playerChoice, interaction.user.id));
  }
});
