import {
  AttachmentBuilder, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags,
  SectionBuilder, TextDisplayBuilder, ThumbnailBuilder
} from "discord.js";
import { renderRankCard } from "../../../averoui/rank-card.js";
import { renderRegisteredAsset } from "../../../averoui/render-asset.js";
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
    level, xp, messages, voiceMinutes,
    progressPercent: Math.round(progress * 100),
    progressBar: bar,
    nextLevelXp
  };
}

export async function buildRankPayload(target, member, { levelUp = false, previousLevel = null } = {}) {
  const stats = formatRankStats(member);
  const card = await renderRankCard({
    username: target.globalName ?? target.username,
    avatarUrl: target.displayAvatarURL?.({ extension: "png", size: 256 }) ?? null,
    ...stats
  });
  const professor = await renderRegisteredAsset("mascot-professor", 64);
  const heading = levelUp
    ? "## LEVEL UP · " + previousLevel + " → " + stats.level
    : "## " + (target.globalName ?? target.username) + " · Rank";
  const container = new ContainerBuilder().setAccentColor(0x3A3D45);
  container.addSectionComponents(new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      "-# AVERO / LEVELING\n" + heading
    ))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL("attachment://avero-professor.png")));
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL("attachment://rank-card.png").setDescription("Avero compact rank card")
  ));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    "-# " + (levelUp ? "KEEP GOING · NEXT LEVEL AWAITS" : "LEVELS & XP POWERED BY ENGAUGE")
  ));
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    files: [
      new AttachmentBuilder(card, { name: "rank-card.png" }),
      new AttachmentBuilder(professor, { name: "avero-professor.png" })
    ],
    allowedMentions: { parse: [] }
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
      await interaction.editReply(await buildRankPayload(target, member));
    } catch (error) {
      const message = error?.status === 404
        ? "Engauge could not find this server or member. Make sure Engauge is installed in this server and recognizes the member."
        : "Rank data is temporarily unavailable. Check the Engauge API connection and try again.";
      await interaction.editReply({ content: message });
    }
  }
});
