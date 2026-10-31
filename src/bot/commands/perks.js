import { MessageFlags } from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";
import { getGuildSettings } from "../../db/guild-settings-repository.js";
import { getRolePerk } from "../role-perks.js";
export const perksCommand = Object.freeze({
  data: Object.freeze({ name: "perks", description: "View your server's Booster, Funder and Voter perks." }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Perks command requires a database client.");
    const settings = await getGuildSettings(prisma, interaction.guildId);
    const perk = getRolePerk(settings, interaction.member);
    const configured = [
      settings.boosterRoleId ? "↗ **Booster** · +10 daily coins" : null,
      settings.funderRoleId ? "✦ **Funder** · +15 daily coins" : null,
      settings.voterRoleId ? "▣ **Voter** · +10 daily coins" : null
    ].filter(Boolean);
    await interaction.reply({
      embeds: [createEmbed({
        title: "Avero perks",
        description: perk.id === "member" ? "No exclusive role perk is active for you yet." : "**" + perk.flair + "** is active · +" + perk.dailyBonus + " daily coins.",
        color: THEME.colors.primary,
        fields: [{ name: "Server perks", value: configured.length ? configured.join("\\n") : "The server has not set up role perks yet." }],
        footer: "One highest-tier perk applies · server-specific · virtual coins only"
      })],
      flags: MessageFlags.Ephemeral
    });
  }
});