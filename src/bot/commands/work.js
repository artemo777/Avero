import { MessageFlags } from "discord.js";
import { getGuildSettings } from "../../db/guild-settings-repository.js";
import { runWork } from "../game-ui.js";

export const workCommand = Object.freeze({
  data: Object.freeze({
    name: "work",
    description: "Complete a shift for Avero coins. Cooldown: 30 minutes."
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Work command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Work rewards are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const settings = await getGuildSettings(prisma, interaction.guildId);
    await interaction.reply(await runWork(prisma, interaction.guildId, interaction.user.id, {
      minReward: settings.workMinReward, maxReward: settings.workMaxReward
    }));
  }
});
