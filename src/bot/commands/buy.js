import { MessageFlags } from "discord.js";
import { renderBuy } from "../game-ui.js";
import { purchaseCurrencyItem } from "../../db/currency-repository.js";
import { SHOP_ITEMS } from "./shop.js";

export const buyCommand = Object.freeze({
  data: Object.freeze({
    name: "buy",
    description: "Unlock a collectible with your Avero coins.",
    options: [{
      type: 3,
      name: "item",
      description: "Choose a shop item.",
      required: true,
      choices: SHOP_ITEMS.map((item) => ({ name: item.name + " — " + item.price + " coins", value: item.id }))
    }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Buy command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Shop purchases are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const item = SHOP_ITEMS.find((candidate) => candidate.id === interaction.options.getString("item", true));
    if (!item) {
      await interaction.reply({ content: "That item is not in the shop.", flags: MessageFlags.Ephemeral });
      return;
    }
    const result = await purchaseCurrencyItem(prisma, interaction.guildId, interaction.user.id, item.id, item.price);
    await interaction.reply(renderBuy(result, item, interaction.user.id));
  }
});
