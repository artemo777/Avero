import { MessageFlags } from "discord.js";
import { runScavenge, SCAVENGE_ROUTES } from "../game-ui.js";

export const scavengeCommand = Object.freeze({
  data: Object.freeze({
    name: "scavenge",
    description: "Pick a route, find coins and collectibles · 10 min cooldown.",
    options: [{
      type: 3,
      name: "route",
      description: "Choose where to explore. Leave blank for a random route.",
      required: false,
      choices: SCAVENGE_ROUTES.map((route) => ({ name: route.name, value: route.id }))
    }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Scavenge command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Scavenge expeditions are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const routeId = interaction.options.getString("route");
    if (routeId && !SCAVENGE_ROUTES.some((route) => route.id === routeId)) {
      await interaction.reply({ content: "Choose one of the listed expedition routes.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply(await runScavenge(prisma, interaction.guildId, interaction.user.id, routeId));
  }
});
