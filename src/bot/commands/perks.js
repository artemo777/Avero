import { MessageFlags } from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";
import { getGuildSettings } from "../../db/guild-settings-repository.js";
import { getRolePerk } from "../role-perks.js";
export const perksCommand = Object.freeze({
  data: Object.freeze({ name: "perks", description: "See which role perks are active for you." }),
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
        title: "Your perks",
        description: perk.id === "member" ? "No role perk active right now." : "**" + perk.flair + "** is active · +" + perk.dailyBonus + " daily coins.",
        color: THEME.colors.primary,
        fields: [{ name: "Available in this server", value: configured.length ? configured.join("\n") : "No role perks have been set up here yet." }],
        footer: "Only your highest role perk applies · virtual coins only"
      })],
      flags: MessageFlags.Ephemeral
    });
  }
});