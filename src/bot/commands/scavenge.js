import { MessageFlags } from "discord.js";
import { runScavenge } from "../game-ui.js";

export const scavengeCommand = Object.freeze({
  data: Object.freeze({
    name: "scavenge",
    description: "Search for Avero coins and a chance at a collectible. Cooldown: 10 minutes."
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Scavenge command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Scavenge rewards are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply(await runScavenge(prisma, interaction.guildId, interaction.user.id));
  }
});
