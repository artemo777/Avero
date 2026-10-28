import { MessageFlags } from "discord.js";
import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";
import { getCurrencyPurchases } from "../../db/currency-repository.js";
import { SHOP_ITEMS } from "./shop.js";

export const inventoryCommand = Object.freeze({
  data: Object.freeze({
    name: "inventory",
    description: "Show the collectibles you've unlocked in this server."
  }),

  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Inventory command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Your Avero collection is available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const purchases = await getCurrencyPurchases(prisma, interaction.guildId, interaction.user.id);
    const itemMap = new Map(SHOP_ITEMS.map((item) => [item.id, item]));
    const items = purchases.map((purchase) => itemMap.get(purchase.itemId)).filter(Boolean);
    const collection = items.length
      ? items.map((item) => item.icon + " **" + item.name + "**  ·  \`" + item.rarity + "\`").join("\n")
      : "Your collection is waiting for its first unlock.\nBrowse \`/shop\` and start with a Neon Badge.";

    await interaction.reply({
      embeds: [createEmbed({
        title: "✦  YOUR AVERO COLLECTION",
        description: "**" + items.length + " / " + SHOP_ITEMS.length + " starter collectibles unlocked**\n\n" +
          collection + "\n\n" +
          (items.length === SHOP_ITEMS.length
            ? "✧ **Set complete!** You've collected every starter item."
            : "Keep collecting. These items are the first step toward future profile customization."),
        color: THEME.colors.primary,
        footer: "AVERO • This collection belongs to you in this server"
      })]
    });
  }
});
