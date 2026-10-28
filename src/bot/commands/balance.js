import { MessageFlags } from "discord.js";
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
      await interaction.reply({ content: "Currency can only be used inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const account = await getCurrencyAccount(prisma, interaction.guildId, interaction.user.id);
    await interaction.reply({
      embeds: [createEmbed({
        title: "✦  YOUR AVERO WALLET",
        description: "**" + (account?.balance ?? 0).toLocaleString("en-US") + " coins**\n\nEarn coins, unlock collectibles, and build your collection. Your wallet is separate in each server.",
        color: THEME.colors.primary,
        footer: "AVERO • COINS & COLLECTIONS"
      })]
    });
  }
});
