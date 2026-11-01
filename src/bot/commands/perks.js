import { MessageFlags } from "discord.js";
import { createGamePanel, gamePayload } from "../game-ui.js";
import { getGuildSettings } from "../../db/guild-settings-repository.js";
import { getRolePerk } from "../role-perks.js";

export const perksCommand = Object.freeze({
  data: Object.freeze({ name: "perks", description: "See which role perks are active for you." }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Perks command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Role perks are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const settings = await getGuildSettings(prisma, interaction.guildId);
    const perk = getRolePerk(settings, interaction.member);
    const configured = [
      settings.boosterRoleId ? "↗ **Booster** · +10 daily coins" : null,
      settings.funderRoleId ? "✦ **Funder** · +15 daily coins" : null,
      settings.voterRoleId ? "▣ **Voter** · +10 daily coins" : null
    ].filter(Boolean);
    const payload = gamePayload(createGamePanel({
      title: "Your perks",
      eyebrow: "ROLE PERKS",
      description: perk.id === "member" ? "No role perk active right now." : "**" + perk.flair + "** is active · +" + perk.dailyBonus + " daily coins.",
      sections: ["**Available in this server**\n" + (configured.length ? configured.join("\n") : "No role perks have been set up here yet.")],
      footer: "HIGHEST ROLE PERK APPLIES • VIRTUAL COINS ONLY",
      separators: true
    }));
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  }
});
