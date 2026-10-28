import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";
import { getCurrencyPurchases } from "../../db/currency-repository.js";

export const SHOP_ITEMS = Object.freeze([
  Object.freeze({ id: "neon_badge", name: "Neon Badge", price: 150, description: "A bright collectible badge for your Avero collection." }),
  Object.freeze({ id: "vault_badge", name: "Vault Badge", price: 300, description: "A rare-looking badge for dedicated coin collectors." }),
  Object.freeze({ id: "starlight_badge", name: "Starlight Badge", price: 500, description: "The premium collectible in the starter shop." })
]);

export const shopCommand = Object.freeze({
  data: Object.freeze({
    name: "shop",
    description: "Browse collectible items you can buy with Avero coins."
  }),

  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Shop command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "The Avero shop is available inside a server.", ephemeral: true });
      return;
    }

    const purchases = await getCurrencyPurchases(prisma, interaction.guildId, interaction.user.id);
    const owned = new Set(purchases.map((purchase) => purchase.itemId));
    const lines = SHOP_ITEMS.map((item) =>
      (owned.has(item.id) ? "✓ **" + item.name + "** — owned" : "**" + item.name + "** — " + item.price + " coins") +
      "\n" + item.description
    );

    await interaction.reply({
      embeds: [createEmbed({
        title: ICONS.game + "  Avero Coin Shop",
        description: lines.join("\n\n") + "\n\nBuy an item with `/buy item`. Items are server-specific collectibles; coins have no cash value.",
        color: THEME.colors.primary,
        footer: "Avero • Earn coins with /daily and /guess"
      })],
      ephemeral: true
    });
  }
});
