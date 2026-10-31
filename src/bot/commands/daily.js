import { MessageFlags } from "discord.js";
import { claimDailyReward } from "../../db/currency-repository.js";
import { getGuildSettings } from "../../db/guild-settings-repository.js";
import { getDailyRewardForMember } from "../role-perks.js";
import { renderDaily } from "../game-ui.js";
import { DAILY_REWARD, DAILY_COOLDOWN_MS } from "../economy-rules.js";

export const dailyCommand = Object.freeze({
  data: Object.freeze({
    name: "daily",
    description: "Grab your daily coin drop."
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Daily command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Currency can only be used inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const settings = await getGuildSettings(prisma, interaction.guildId);
    const { amount, perk } = getDailyRewardForMember(settings.dailyReward ?? DAILY_REWARD, settings, interaction.member);
    const result = await claimDailyReward(prisma, interaction.guildId, interaction.user.id, {
      amount, cooldownMs: DAILY_COOLDOWN_MS
    });
    await interaction.reply(renderDaily(result, interaction.user.id, { reward: amount, perk }));
  }
});
