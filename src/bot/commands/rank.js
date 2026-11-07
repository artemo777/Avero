import { MessageFlags } from "discord.js";
import { createGamePanel, gamePayload } from "../game-ui.js";
import { createEngaugeClient } from "../engauge-api.js";

const engauge = createEngaugeClient();
const number = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
export function formatRankStats(member) {
  const xp = number(member?.xp ?? member?.totalXp);
  const level = Math.floor(number(member?.level));
  const nextLevelXp = number(member?.levelXp ?? member?.nextLevelXp);
  const messages = Math.floor(number(member?.messages ?? member?.messageCount));
  const voiceSeconds = Math.floor(number(member?.voiceSeconds));
  const voiceMinutes = Math.floor(voiceSeconds / 60);
  const progress = nextLevelXp > 0 ? Math.min(1, xp / nextLevelXp) : 0;
  const filled = Math.round(progress * 12);
  const bar = "▰".repeat(filled) + "▱".repeat(12 - filled);
  return {
    level,
    xp,
    messages,
    voiceMinutes,
    progressPercent: Math.round(progress * 100),
    progressBar: bar,
    nextLevelXp
  };
}
export const rankCommand = Object.freeze({
  data: Object.freeze({
    name: "rank",
    description: "View your Engauge level, XP and activity stats.",
    options: [{
      type: 6,
      name: "member",
      description: "Member whose rank to view.",
      required: false
    }]
  }),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Rank cards are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const target = interaction.options.getUser("member") ?? interaction.user;
    await interaction.deferReply();
    try {
      const member = await engauge.getMember(interaction.guildId, target.id);
      const stats = formatRankStats(member);
      const description = [
        "**LEVEL** · " + stats.level,
        "**TOTAL XP** · " + stats.xp.toLocaleString("en-US"),
        stats.nextLevelXp > 0
          ? stats.progressBar + "  " + stats.progressPercent + "% to next level · " + stats.nextLevelXp.toLocaleString("en-US") + " XP"
          : "Maximum level progress unavailable",
        "",
        "**MESSAGES SENT** · " + stats.messages.toLocaleString("en-US"),
        "**VOICE TIME** · " + stats.voiceMinutes.toLocaleString("en-US") + " minutes"
      ].join("\n");
      await interaction.editReply({
        ...gamePayload(createGamePanel({
          title: target.username + " · Rank",
          eyebrow: "AVERO / LEVELING",
          description,
          footer: "LEVELS & XP POWERED BY ENGAUGE",
          separators: true
        })),
        allowedMentions: { parse: [] }
      });
    } catch (error) {
      const message = error?.status === 404
        ? "Engauge could not find this server or member. Make sure Engauge is installed in this server and recognizes the member."
        : "Rank data is temporarily unavailable. Check the Engauge API connection and try again.";
      await interaction.editReply({ content: message });
    }
  }
});
