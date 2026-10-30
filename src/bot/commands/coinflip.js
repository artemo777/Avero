import { MessageFlags } from "discord.js";
import { runCoinflip } from "../game-ui.js";

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
    if (call !== "heads" && call !== "tails") {
      await interaction.reply({ content: "Choose heads or tails.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!prisma) throw new Error("Coinflip requires a database client.");
    await interaction.reply(await runCoinflip(prisma, interaction.guildId, call, interaction.user.id));
  }
});
