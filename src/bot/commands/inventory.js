import { MessageFlags } from "discord.js";
import { renderInventory } from "../game-ui.js";

export const inventoryCommand = Object.freeze({
  data: Object.freeze({
    name: "inventory",
    description: "View your collectibles and badges."
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Inventory command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Your Avero collection is available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply(await renderInventory(prisma, interaction.guildId, interaction.user.id));
  }
});
