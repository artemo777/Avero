import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";
import { getCurrencyAccount } from "../../db/currency-repository.js";

export const balanceCommand = Object.freeze({
  data: Object.freeze({
    name: "balance",
    description: "Check your Avero coin balance in this server."
  }),

  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Balance command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Currency can only be used inside a server.", ephemeral: true });
      return;
    }

    const account = await getCurrencyAccount(prisma, interaction.guildId, interaction.user.id);
    await interaction.reply({
      embeds: [createEmbed({
        title: ICONS.game + "  Your Avero balance",
        description: "**" + (account?.balance ?? 0).toLocaleString("en-US") + " coins**\nYour wallet is separate in each server.",
        color: THEME.colors.primary,
        footer: "Avero • Currency"
      })],
      ephemeral: true
    });
  }
});
