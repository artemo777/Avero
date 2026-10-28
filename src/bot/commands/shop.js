import { MessageFlags } from "discord.js";
import { renderShop } from "../game-ui.js";

export const SHOP_ITEMS = Object.freeze([
  Object.freeze({ id: "neon_badge", name: "Neon Badge", price: 150, icon: "✦", rarity: "UNCOMMON", description: "A bright neon accent for your future Avero profile." }),
  Object.freeze({ id: "vault_badge", name: "Vault Badge", price: 300, icon: "⬡", rarity: "RARE", description: "A vault-worthy collectible for your growing collection." }),
  Object.freeze({ id: "starlight_badge", name: "Starlight Badge", price: 500, icon: "✧", rarity: "EPIC", description: "A celestial flex for collectors saving up for something special." })
]);

export const shopCommand = Object.freeze({
  data: Object.freeze({
    name: "shop",
    description: "Browse and unlock collectibles with Avero coins."
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Shop command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "The Avero shop is available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply(await renderShop(prisma, interaction.guildId, interaction.user.id));
  }
});
