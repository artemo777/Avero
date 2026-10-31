import { MessageFlags } from "discord.js";
import { renderShop } from "../game-ui.js";
import { SHOP_ITEMS } from "../shop-catalog.js";
export { SHOP_ITEMS } from "../shop-catalog.js";

export const shopCommand = Object.freeze({
  data: Object.freeze({
    name: "shop",
    description: "Browse collectibles across three themed sets."
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
