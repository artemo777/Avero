import { MessageFlags } from "discord.js";
import { createGamePanel, gamePayload } from "../game-ui.js";
import { getActivitySettings, getActivityPeriodKey, getActivityRanking } from "../../db/activity-repository.js";

export const activityCommand = Object.freeze({
  data: Object.freeze({ name: "activity", description: "View this server's live activity rankings." }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma || !interaction.guildId) {
      await interaction.reply({ content: "Activity rankings are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const settings = await getActivitySettings(prisma, interaction.guildId);
    const [dailyKey, weeklyKey] = [
      getActivityPeriodKey("daily", new Date(), settings.timezone, settings.weeklyResetDay),
      getActivityPeriodKey("weekly", new Date(), settings.timezone, settings.weeklyResetDay)
    ];
    const [daily, weekly] = await Promise.all([
      getActivityRanking(prisma, interaction.guildId, "daily", dailyKey, settings, 3),
      getActivityRanking(prisma, interaction.guildId, "weekly", weeklyKey, settings, 3)
    ]);
    const format = (rows) => rows.length ? rows.map((row, i) => (["Ⅰ", "Ⅱ", "Ⅲ"][i] + "  <@" + row.userId + "> · **" + Math.round(row.score).toLocaleString("en-US") + " pt**")).join("\n") : "-# No activity yet.";
    await interaction.reply({ ...gamePayload(createGamePanel({
      title: "Activity rankings",
      eyebrow: "◈ AVERO / LIVE ACTIVITY",
      description: "**DAILY**\n" + format(daily) + "\n\n**WEEKLY**\n" + format(weekly),
      footer: "WEIGHTED MESSAGE + VOICE ACTIVITY",
      separators: true
    })), allowedMentions: { parse: [] } });
  }
});