import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder,
  PermissionFlagsBits, TextInputBuilder, TextInputStyle
} from "discord.js";
import { createGamePanel, gamePayload } from "./game-ui.js";
import { getActivitySettings, updateActivitySettings, upsertActivityRewardRule } from "../db/activity-repository.js";
import { publishActivityBoards } from "./activity-leaderboards.js";
import { THEME } from "../../averoui/theme.js";
import { getAssetSymbol } from "../../averoui/assets.js";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const canManage = (interaction) => Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
const field = (id, label, value, required = false, maxLength = 100) => {
  const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(required).setMaxLength(maxLength);
  if (value !== null && value !== undefined && String(value).length) input.setValue(String(value).slice(0, maxLength));
  return new ActionRowBuilder().addComponents(input);
};
function modal(kind, settings) {
  const result = new ModalBuilder().setCustomId("avero-config-modal|" + kind)
    .setTitle(kind === "activity-channels" ? "Leaderboard channels" : kind === "activity-scoring" ? "Activity scoring" : kind === "activity-schedule" ? "Reset schedule" : "Placement reward");
  if (kind === "activity-channels") result.addComponents(
    field("dailyChannelId", "Daily channel ID (blank disables)", settings.dailyChannelId),
    field("weeklyChannelId", "Weekly channel ID (blank disables)", settings.weeklyChannelId)
  );
  else if (kind === "activity-scoring") result.addComponents(
    field("messageWeight", "Points per message (0–1000)", settings.messageWeight, true),
    field("voiceWeight", "Points per voice minute (0–1000)", settings.voiceWeight, true)
  );
  else if (kind === "activity-schedule") result.addComponents(
    field("timezone", "IANA timezone (e.g. Europe/Stockholm)", settings.timezone, true, 80),
    field("weeklyResetDay", "Weekly reset day (0 Sunday – 6 Saturday)", settings.weeklyResetDay, true),
    field("voiceMinParticipants", "Minimum human voice participants (2–99)", settings.voiceMinParticipants, true)
  );
  else result.addComponents(
    field("periodType", "Period: daily or weekly", "weekly", true, 6),
    field("position", "Placement (1–10)", "1", true, 2),
    field("roleId", "Discord role ID (blank = none)", "", false, 20),
    field("coins", "Coin reward (0–1000000)", "0", true, 10),
    field("xp", "XP reward (0–1000000)", "0", true, 10)
  );
  return result;
}
export async function buildActivityConfigPanel(prisma, guildId, guildName) {
  const s = await getActivitySettings(prisma, guildId);
  const rewards = await prisma.activityRewardRule.findMany({ where: { guildId }, orderBy: [{ periodType: "asc" }, { position: "asc" }] });
  const rewardLines = rewards.length ? rewards.map((reward) => (reward.periodType === "daily" ? "Daily" : "Weekly") + " #" + reward.position + " · " + (reward.roleId ? getAssetSymbol("badge") + " <@&" + reward.roleId + ">" : "No role") + " · " + getAssetSymbol("coin") + " " + reward.coins + " · " + reward.xp + " XP").join("\n") : "No placement rewards configured.";
  const buttons = [
    { customId: "avero-config|activity-channels", label: "Set board channels", style: ButtonStyle.Primary },
    { customId: "avero-config|activity-scoring", label: "Scoring weights", style: ButtonStyle.Secondary },
    { customId: "avero-config|activity-schedule", label: "Reset & voice rules", style: ButtonStyle.Secondary },
    { customId: "avero-config|activity-reward", label: "Configure placement reward", style: ButtonStyle.Secondary },
    { customId: "avero-config|activity-publish", label: "Publish / repair boards", style: ButtonStyle.Success },
    { customId: "avero-config|activity-back", label: "Back to config", style: ButtonStyle.Secondary }
  ];
  return gamePayload(createGamePanel({
    title: "Activity management",
    eyebrow: "◈ AVERO / CONFIG",
    description: "**" + guildName + "**\n\n**01 · LIVE BOARDS**\nDaily · " + (s.dailyChannelId ? "<#" + s.dailyChannelId + ">" : "Not configured") + "\nWeekly · " + (s.weeklyChannelId ? "<#" + s.weeklyChannelId + ">" : "Not configured") +
      "\n\n**02 · WEIGHTED SCORE**\nMessages · " + s.messageWeight + " pt each\nVoice · " + s.voiceWeight + " pt / minute\n\n**03 · SCHEDULE & VOICE**\nTimezone · " + s.timezone + "\nWeekly reset · " + DAY_LABELS[s.weeklyResetDay] + "\nRefresh · Every 5 minutes\nVoice minimum · " + s.voiceMinParticipants + " humans\n\n" + getAssetSymbol("reward-sparkle") + " **PLACEMENT REWARDS**\n" + rewardLines + "\n\n∴ **PROFESSOR'S NOTE**\nVoice time accrues only while unmuted, undeafened members share a voice channel with another human. Discord does not expose actual speaking activity through voice-state events alone.",
    color: THEME.colors.primary, buttons,
    footer: "MANAGE SERVER REQUIRED · SERVER-SCOPED SETTINGS", separators: true
  }));
}
export async function handleActivityConfigButton(interaction, prisma) {
  if (!interaction.customId?.startsWith("avero-config|activity")) return false;
  if (!interaction.guildId || !canManage(interaction)) {
    await interaction.reply({ content: "Manage Server permission is required.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const action = interaction.customId.split("|")[1];
  if (action === "activity") {
    await interaction.update(await buildActivityConfigPanel(prisma, interaction.guildId, interaction.guild.name));
    return true;
  }
  if (action === "activity-back") {
    const { getGuildSettings } = await import("../db/guild-settings-repository.js");
    const { buildConfigPanel } = await import("./commands/config.js");
    await interaction.update(buildConfigPanel(await getGuildSettings(prisma, interaction.guildId), interaction.guild.name));
    return true;
  }
  if (action === "activity-publish") {
    const results = await publishActivityBoards(interaction.client, prisma, interaction.guild);
    await interaction.update(await buildActivityConfigPanel(prisma, interaction.guildId, interaction.guild.name));
    if (!results.some(Boolean)) await interaction.followUp({ content: "Configure at least one valid text channel first.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  if (["activity-channels", "activity-scoring", "activity-schedule", "activity-reward"].includes(action)) {
    const settings = await getActivitySettings(prisma, interaction.guildId);
    await interaction.showModal(modal(action, settings));
    return true;
  }
  return false;
}
export async function handleActivityConfigModal(interaction, prisma) {
  if (!interaction.customId?.startsWith("avero-config-modal|activity-")) return false;
  if (!interaction.guildId || !canManage(interaction)) {
    await interaction.reply({ content: "Manage Server permission is required.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const kind = interaction.customId.split("|")[1];
  const read = (id) => interaction.fields.getTextInputValue(id).trim();
  if (kind === "activity-channels") {
    const values = {};
    for (const name of ["dailyChannelId", "weeklyChannelId"]) {
      const id = read(name);
      if (id) {
        if (!/^\d{17,20}$/.test(id)) throw new Error("Enter a valid channel ID.");
        const channel = await interaction.guild.channels.fetch(id).catch(() => null);
        if (!channel?.isTextBased?.() || !channel.messages) throw new Error("Choose a text channel in this server.");
        const permissions = channel.permissionsFor(interaction.guild.members.me);
        if (!permissions?.has(["ViewChannel", "SendMessages"])) throw new Error("Avero needs View Channel and Send Messages in the selected channel.");
      }
      values[name] = id || null;
    }
    await updateActivitySettings(prisma, interaction.guildId, values);
    await publishActivityBoards(interaction.client, prisma, interaction.guild);
    await interaction.reply({ content: "Leaderboard channels saved. Avero has published the configured boards and will keep updating those messages.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (kind === "activity-scoring") {
    const messageWeight = Number(read("messageWeight")), voiceWeight = Number(read("voiceWeight"));
    await updateActivitySettings(prisma, interaction.guildId, { messageWeight, voiceWeight });
    await interaction.reply({ content: "Weighted activity scoring saved. Existing raw activity records were not changed.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (kind === "activity-schedule") {
    const weeklyResetDay = Number(read("weeklyResetDay")), voiceMinParticipants = Number(read("voiceMinParticipants"));
    await updateActivitySettings(prisma, interaction.guildId, { timezone: read("timezone"), weeklyResetDay, voiceMinParticipants });
    await interaction.reply({ content: "Activity schedule and voice eligibility settings saved.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (kind === "activity-reward") {
    const periodType = read("periodType"), position = Number(read("position")), roleId = read("roleId"), coins = Number(read("coins")), xp = Number(read("xp"));
    if (!["daily", "weekly"].includes(periodType)) throw new Error("Period must be daily or weekly.");
    if (roleId) {
      if (!/^\d{17,20}$/.test(roleId) || !await interaction.guild.roles.fetch(roleId).catch(() => null)) throw new Error("Choose a valid role from this server.");
    }
    await upsertActivityRewardRule(prisma, interaction.guildId, periodType, position, { roleId: roleId || null, coins, xp, enabled: true });
    await interaction.reply({ content: "Placement reward saved. Role, coin, and XP rewards are applied directly by Avero.", flags: MessageFlags.Ephemeral });
    return true;
  }
  return false;
}