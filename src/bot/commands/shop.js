import { MessageFlags } from "discord.js";
import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";
import { getCurrencyPurchases } from "../../db/currency-repository.js";

export const SHOP_ITEMS = Object.freeze([
  Object.freeze({ id: "neon_badge", name: "Neon Badge", price: 150, icon: "✦", rarity: "UNCOMMON", description: "A bright neon accent for your future Avero profile." }),
  Object.freeze({ id: "vault_badge", name: "Vault Badge", price: 300, icon: "⬡", rarity: "RARE", description: "A vault-worthy collectible for your growing collection." }),
  Object.freeze({ id: "starlight_badge", name: "Starlight Badge", price: 500, icon: "✧", rarity: "EPIC", description: "A celestial flex for collectors saving up for something special." })
]);

export const shopCommand = Object.freeze({
  data: Object.freeze({
    name: "shop",
    description: "Browse collectibles you can unlock with Avero coins."
  }),

  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Shop command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "The Avero shop is available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const purchases = await getCurrencyPurchases(prisma, interaction.guildId, interaction.user.id);
    const owned = new Set(purchases.map((purchase) => purchase.itemId));
    const lines = SHOP_ITEMS.map((item) => {
      const status = owned.has(item.id) ? "✓ **OWNED**" : "**" + item.price + " coins**";
      return item.icon + " **" + item.name + "**  ·  \`" + item.rarity + "\`  ·  " + status +
        "\n> " + item.description;
    });

    await interaction.reply({
      embeds: [createEmbed({
        title: "✦  AVERO // THE DROP",
        description: "A small collection today. A full profile customizer later.\n\n" +
          lines.join("\n\n") +
          "\n\n**How to unlock**\nUse \`/buy item\` to claim a collectible. Earn coins with \`/daily\` and \`/guess\`.\n" +
          "_Items and coins are virtual, have no cash value, and are scoped to this server._",
        color: THEME.colors.primary,
        footer: "AVERO • THE COLLECTION STARTS HERE"
      })]
    });
  }
});
