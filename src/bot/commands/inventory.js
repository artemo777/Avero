import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";
import { getCurrencyPurchases } from "../../db/currency-repository.js";
import { SHOP_ITEMS } from "./shop.js";

export const inventoryCommand = Object.freeze({
  data: Object.freeze({
    name: "inventory",
    description: "View the Avero collectibles you own in this server."
  }),

  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Inventory command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Your Avero inventory is available inside a server.", ephemeral: true });
      return;
    }

    const purchases = await getCurrencyPurchases(prisma, interaction.guildId, interaction.user.id);
    const itemNames = new Map(SHOP_ITEMS.map((item) => [item.id, item.name]));
    const lines = purchases
      .filter((purchase) => itemNames.has(purchase.itemId))
      .map((purchase) => "• **" + itemNames.get(purchase.itemId) + "**");

    await interaction.reply({
      embeds: [createEmbed({
        title: ICONS.game + "  Your Collectibles",
        description: lines.length
          ? lines.join("\n")
          : "Your collection is empty for now. Visit `/shop` to browse collectibles.",
        color: THEME.colors.primary,
        footer: "Avero • This inventory is server-specific"
      })],
      ephemeral: true
    });
  }
});
