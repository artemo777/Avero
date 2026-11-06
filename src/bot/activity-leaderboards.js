import {
  ContainerBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder
} from "discord.js";
import { THEME } from "../../averoui/theme.js";
import { getAssetSymbol } from "../../averoui/assets.js";
import {
  getActivitySettings, getActivityPeriodKey, getActivityRanking, recordActivityMessage,
  settleVoiceSession, upsertVoiceSession
} from "../db/activity-repository.js";

const SYMBOLS = Object.freeze(["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ"]);
const lastBoardUpdate = new Map();
const fmt = (value) => Math.round(value).toLocaleString("en-US");
const fmtScore = (value) => Number(value.toFixed(2)).toLocaleString("en-US", { maximumFractionDigits: 2 });
function boardPayload(periodType, periodKey, rows, settings, guildName) {
  const title = periodType === "weekly" ? "WEEKLY ACTIVITY" : "DAILY ACTIVITY";
  const body = rows.length ? rows.map((row, index) => {
    const voiceMinutes = Math.floor(row.voiceSeconds / 60);
    return "**" + SYMBOLS[index] + "  <@" + row.userId + ">**  ·  **" + fmtScore(row.score) + " pt**\n-# " + fmt(row.messages) + " messages  ·  " + fmt(voiceMinutes) + " voice min";
  }).join("\n") : "-# No activity recorded yet. Be the first on the board.";
  const container = new ContainerBuilder().setAccentColor(THEME.colors.primary);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    "-# " + getAssetSymbol("brand-mark-svg") + " AVERO  /  ACTIVITY\n## " + title + "\n-# " + guildName + "  ·  " + periodKey + "\n\n" +
    "**WEIGHTED SCORE**  ·  " + settings.messageWeight + "× messages + " + settings.voiceWeight + "× voice minutes"
  ));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    "-# " + (periodType === "weekly" ? "WEEKLY" : "DAILY") + " CYCLE  ·  Updates automatically  ·  Top 10"
  ));
  return { flags: MessageFlags.IsComponentsV2, components: [container], allowedMentions: { parse: [] } };
}
async function getBoardMessage(client, guild, settings, periodType) {
  const channelId = periodType === "daily" ? settings.dailyChannelId : settings.weeklyChannelId;
  const messageId = periodType === "daily" ? settings.dailyMessageId : settings.weeklyMessageId;
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.() || !channel.messages) return null;
  let message = messageId ? await channel.messages.fetch(messageId).catch(() => null) : null;
  return { channel, message };
}
async function renderBoard(client, prisma, guild, periodType, now = new Date()) {
  const settings = await getActivitySettings(prisma, guild.id);
  const periodKey = getActivityPeriodKey(periodType, now, settings.timezone, settings.weeklyResetDay);
  const rows = await getActivityRanking(prisma, guild.id, periodType, periodKey, settings, 10);
  const target = await getBoardMessage(client, guild, settings, periodType);
  if (!target) return false;
  const payload = boardPayload(periodType, periodKey, rows, settings, guild.name);
  if (target.message) {
    await target.message.edit(payload);
  } else {
    const sent = await target.channel.send(payload);
    await prisma.activityBoardSetting.update({
      where: { guildId: guild.id },
      data: periodType === "daily" ? { dailyMessageId: sent.id } : { weeklyMessageId: sent.id }
    });
  }
  return true;
}
export async function publishActivityBoards(client, prisma, guild) {
  const results = await Promise.all([
    renderBoard(client, prisma, guild, "daily"),
    renderBoard(client, prisma, guild, "weekly")
  ]);
  return results;
}
export async function recordMessageActivity(message, prisma) {
  return recordActivityMessage(prisma, message);
}
function isVoiceEligible(state, settings, guild) {
  if (!state?.channelId || !state.member || state.member.user?.bot) return false;
  if (state.channelId === guild.afkChannelId) return false;
  if (state.selfMute || state.serverMute || state.selfDeaf || state.serverDeaf) return false;
  const channel = state.channel;
  const humans = channel?.members?.filter((member) => !member.user.bot).size ?? 0;
  return humans >= settings.voiceMinParticipants;
}
async function syncVoiceChannel(prisma, guild, channel) {
  if (!channel) return;
  const now = new Date();
  const members = [...channel.members.values()].filter((member) => !member.user.bot);
  const settings = await getActivitySettings(prisma, guild.id);
  for (const member of members) {
    const state = member.voice;
    const eligible = isVoiceEligible(state, settings, guild);
    const existing = await prisma.activityVoiceSession.findUnique({
      where: { guildId_userId: { guildId: guild.id, userId: member.id } }
    });
    if (existing && (!eligible || existing.channelId !== channel.id)) {
      await settleVoiceSession(prisma, existing, now, true);
    }
    if (eligible && (!existing || existing.channelId !== channel.id)) {
      await upsertVoiceSession(prisma, guild.id, member.id, channel.id, now);
    }
  }
}
export async function handleVoiceStateUpdate(prisma, oldState, newState) {
  const guild = newState.guild ?? oldState.guild;
  const memberId = newState.id ?? oldState.id;
  const settings = await getActivitySettings(prisma, guild.id);
  const existing = memberId ? await prisma.activityVoiceSession.findUnique({
    where: { guildId_userId: { guildId: guild.id, userId: memberId } }
  }) : null;
  if (existing && (!isVoiceEligible(newState, settings, guild) || newState.channelId !== existing.channelId)) {
    await settleVoiceSession(prisma, existing, new Date(), true);
  }
  const channels = new Set([oldState.channel, newState.channel].filter(Boolean));
  for (const channel of channels) await syncVoiceChannel(prisma, guild, channel);
}
async function recoverVoiceSessions(client, prisma) {
  const now = new Date();
  const sessions = await prisma.activityVoiceSession.findMany();
  for (const session of sessions) await settleVoiceSession(prisma, session, now, true);
  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (channel.isVoiceBased?.()) await syncVoiceChannel(prisma, guild, channel);
    }
  }
}
async function processClosedPeriodRewards(client, prisma, guild, periodType, now) {
  const settings = await getActivitySettings(prisma, guild.id);
  const previous = new Date(now);
  previous.setDate(previous.getDate() - (periodType === "daily" ? 1 : 7));
  const periodKey = getActivityPeriodKey(periodType, previous, settings.timezone, settings.weeklyResetDay);
  const rules = await prisma.activityRewardRule.findMany({
    where: { guildId: guild.id, periodType, enabled: true },
    orderBy: { position: "asc" }
  });
  if (!rules.length) return;
  const ranking = await getActivityRanking(prisma, guild.id, periodType, periodKey, settings, 10);
  for (const rule of rules) {
    const winner = ranking[rule.position - 1];
    if (!winner) continue;
    const claimKey = { guildId: guild.id, periodType, periodKey, position: rule.position };
    let claim;
    try {
      claim = await prisma.$transaction(async (tx) => {
        const created = await tx.activityRewardClaim.create({
          data: { ...claimKey, userId: winner.userId, roleId: rule.roleId, coins: rule.coins, xp: rule.xp, status: "pending" }
        });
        if (rule.coins > 0) {
          const walletKey = { guildId: "__avero_global__", userId: winner.userId };
          await tx.currencyAccount.upsert({ where: { guildId_userId: walletKey }, create: walletKey, update: {} });
          await tx.currencyAccount.update({ where: { guildId_userId: walletKey }, data: { balance: { increment: rule.coins } } });
          await tx.currencyTransaction.create({
            data: { ...walletKey, amount: rule.coins, currency: "coins", type: "activity_" + periodType + "_reward" }
          });
        }
        return created;
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      claim = await prisma.activityRewardClaim.findUnique({
        where: { guildId_periodType_periodKey_position: claimKey }
      });
    }
    if (!claim || claim.status === "delivered" || claim.status === "pending_xp_formula") continue;
    let roleDelivered = !claim.roleId;
    if (claim.roleId) {
      try {
        const role = await guild.roles.fetch(claim.roleId);
        const member = await guild.members.fetch(claim.userId);
        if (!role || role.id === guild.id || !role.editable) throw new Error("Reward role is unavailable or above Avero's role.");
        await member.roles.add(role, "Avero activity leaderboard reward");
        roleDelivered = true;
      } catch (error) {
        console.error("Activity reward role delivery failed for guild " + guild.id + ":", error);
      }
    }
    const status = !roleDelivered ? "pending_role" : claim.xp > 0 ? "pending_xp_formula" : "delivered";
    await prisma.activityRewardClaim.update({
      where: { id: claim.id },
      data: { status, ...(status === "delivered" ? { deliveredAt: new Date() } : {}) }
    });
  }
}
export async function updateActivityBoards(client, prisma) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const settings = await getActivitySettings(prisma, guild.id);
      await processClosedPeriodRewards(client, prisma, guild, "daily", new Date());
      await processClosedPeriodRewards(client, prisma, guild, "weekly", new Date());
      for (const periodType of ["daily", "weekly"]) {
        const channelId = periodType === "daily" ? settings.dailyChannelId : settings.weeklyChannelId;
        const key = guild.id + ":" + periodType;
        const last = lastBoardUpdate.get(key) ?? 0;
        if (channelId && Date.now() - last >= settings.updateIntervalSeconds * 1000) {
          await renderBoard(client, prisma, guild, periodType);
          lastBoardUpdate.set(key, Date.now());
        }
      }
    } catch (error) {
      console.error("Activity leaderboard update failed for guild " + guild.id + ":", error);
    }
  }
}
export function startActivityRuntime(client, prisma) {
  void recoverVoiceSessions(client, prisma).catch((error) => console.error("Voice-session recovery failed:", error));
  const timer = setInterval(() => {
    void (async () => {
      const sessions = await prisma.activityVoiceSession.findMany();
      for (const session of sessions) await settleVoiceSession(prisma, session, new Date(), false);
      await updateActivityBoards(client, prisma);
    })().catch((error) => console.error("Activity runtime tick failed:", error));
  }, 30_000);
  timer.unref?.();
  return timer;
}