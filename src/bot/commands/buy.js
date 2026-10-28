import { MessageFlags } from "discord.js";
import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";
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
      choices: SHOP_ITEMS.map((item) => ({
        name: item.name + " — " + item.price + " coins",
        value: item.id
      }))
    }]
  }),

  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Buy command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Shop purchases are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const itemId = interaction.options.getString("item", true);
    const item = SHOP_ITEMS.find((candidate) => candidate.id === itemId);
    if (!item) {
      await interaction.reply({ content: "That item is not in the shop.", flags: MessageFlags.Ephemeral });
      return;
    }

    const result = await purchaseCurrencyItem(
      prisma, interaction.guildId, interaction.user.id, item.id, item.price
    );

    const title = result.purchased
      ? "✦  ITEM UNLOCKED"
      : result.reason === "owned"
        ? ICONS.warning + "  Already owned"
        : ICONS.warning + "  Not enough coins";
    const description = result.purchased
      ? item.icon + " You unlocked **" + item.name + "** for **" + item.price + " coins**.\nRemaining balance: **" + result.account.balance.toLocaleString("en-US") + " coins**.\n\nYour collection is growing. More profile customizations are planned for a future update."
      : result.reason === "owned"
        ? "You already own **" + item.name + "**. You won't be charged again."
        : "**" + item.name + "** costs " + item.price + " coins, but your balance is **" +
          result.account.balance.toLocaleString("en-US") + "**. Earn more with \`/daily\` or \`/guess\`.";

    await interaction.reply({
      embeds: [createEmbed({
        title,
        description,
        color: result.purchased ? THEME.colors.success : THEME.colors.warning,
        footer: "AVERO • VIRTUAL COLLECTIBLES"
      })],
      ...(result.purchased ? {} : { flags: MessageFlags.Ephemeral })
    });
  }
});
