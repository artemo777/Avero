import { MessageFlags } from "discord.js";
import { renderBalance } from "../game-ui.js";

export const balanceCommand = Object.freeze({
  data: Object.freeze({
    name: "balance",
    description: "Open your interactive Avero coin wallet."
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Balance command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Currency can only be used inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply(await renderBalance(prisma, interaction.guildId, interaction.user.id));
  }
});
