import {
  ContainerBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder
} from "discord.js";
import { THEME } from "../../averoui/theme.js";
import { getAssetSymbol } from "../../averoui/assets.js";
import { applyMemberXpInTransaction } from "../db/xp-repository.js";
import { buildRankPayload } from "./commands/rank.js";
import {
  getActivitySettings, getActivityPeriodKey, getActivityRanking, recordActivityMessage,
  settleVoiceSession, upsertVoiceSession
} from "../db/activity-repository.js";

const SYMBOLS = Object.freeze(["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ"]);
const lastBoardUpdate = new Map();
export const ACTIVITY_BOARD_REFRESH_INTERVAL_MS = 5 * 60_000;
const fmt = (value) => Math.round(value).toLocaleString("en-US");
const fmtScore = (value) => Number(value.toFixed(2)).toLocaleString("en-US", { maximumFractionDigits: 2 });
export function buildActivityBoardPayload(periodType, periodKey, rows, settings) {
  const title = periodType === "weekly" ? "WEEKLY ACTIVITY" : "DAILY ACTIVITY";
  const resetLabel = periodType === "weekly"
    ? "Resets every " + ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][settings.weeklyResetDay]
    : "Resets daily";
  const podium = rows.slice(0, 3).map((row, index) => {
    const rank = String(index + 1).padStart(2, "0");
    const messages = fmt(row.messages);
    const voice = fmt(Math.floor(row.voiceSeconds / 60));
    const marker = ["✦", "◆", "◇"][index];
    return "**" + rank + " " + marker + "**  **<@" + row.userId + ">**  ·  **" +
      fmtScore(row.score) + " pt**\n-# " + messages + " messages  ·  " + voice + " voice min";
  });
  const remaining = rows.slice(3).map((row, index) => {
    const rank = String(index + 4).padStart(2, "0");
    const messages = fmt(row.messages);
    const voice = fmt(Math.floor(row.voiceSeconds / 60));
    return "**" + rank + "**  <@" + row.userId + ">  ·  **" + fmtScore(row.score) +
      " pt**  ·  " + messages + " msg  ·  " + voice + " min";
  });
  const sections = [];
  if (podium.length) sections.push(podium.join("\n"));
  if (remaining.length) sections.push("**THE RANKINGS**\n" + remaining.join("\n"));
  const body = rows.length ? sections.join("\n\n") : "-# No activity recorded yet. Be the first on the board.";
  const container = new ContainerBuilder().setAccentColor(0x3A3D45);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    "## " + getAssetSymbol("brand-mark-svg") + " " + title + "\n" +
    "-# LIVE SERVER RANKING  ·  " + periodKey + "  ·  " + resetLabel
  ));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    "-# AUTO-REFRESH · EVERY 5 MIN"
  ));
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    // Keep Discord user mentions visible while explicitly suppressing all notifications.
    allowedMentions: { parse: [], users: [], roles: [], repliedUser: false }
  };
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
  const payload = buildActivityBoardPayload(periodType, periodKey, rows, settings);
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
export async function deliverPendingActivityXp(prisma, take = 25, _unusedApiClient = null, context = null, logger = console) {
  const pending = await prisma.activityXpAward.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, take });
  let delivered = 0;
  for (const award of pending) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const claim = await tx.activityXpAward.updateMany({ where: { id: award.id, status: "pending" }, data: { status: "in_flight" } });
        if (!claim.count) return null;
        const applied = await applyMemberXpInTransaction(tx, award.userId, award.amount);
        await tx.activityXpAward.update({ where: { id: award.id }, data: { status: "delivered" } });
        return applied;
      });
      if (!result) continue;
      delivered += 1;
      if (result.profile.level > result.previousLevel) {
        try {
          const client = context?.guilds ? context : context?.client;
          const guild = client?.guilds?.cache?.get(award.guildId);
          const messageTarget = context?.guildId === award.guildId && context?.author?.id === award.userId ? context.channel : guild?.systemChannel;
          const user = context?.author?.id === award.userId ? context.author : await guild?.members?.fetch(award.userId).then((member) => member.user).catch(() => null);
          if (user && typeof messageTarget?.send === "function") {
            const payload = await buildRankPayload(user, { ...result.profile, messages: result.profile.totalMessages, voiceSeconds: result.profile.totalVoiceSeconds }, { levelUp: true, previousLevel: result.previousLevel });
            await messageTarget.send(payload);
          }
        } catch (notificationError) { logger.error?.("Avero level-up announcement failed for member " + award.userId + ":", notificationError?.message ?? notificationError); }
      }
    } catch (error) {
      // XP and the outbox status share one transaction, so failed writes are safe to retry.
      logger.error?.("Avero local activity XP delivery failed for award " + award.id + ":", error?.message ?? error);
    }
  }
  return delivered;
}
export async function recordMessageActivity(message, prisma) {
  const recorded = await recordActivityMessage(prisma, message);
  if (recorded) {
    void deliverPendingActivityXp(prisma, 25, null, message).catch((error) => {
      console.error("Avero message XP delivery failed:", error);
    });
  }
  return recorded;
}
function isVoiceEligible(state, settings, guild) {
  if (!state?.channelId || !state.member || state.member.user?.bot) return false;
  if (state.channelId === guild.afkChannelId) return false;
  if (settings.ignoredChannelIds?.includes(state.channelId)) return false;
  if (state.selfMute || state.serverMute || state.selfDeaf || state.serverDeaf) return false;
  const channel = state.channel;
  const humans = channel?.members?.filter((member) => !member.user.bot).size ?? 0;
  return humans >= settings.voiceMinParticipants;
}
export function isActivityVoiceSessionEligible(client, session, settings) {
  const guild = client.guilds.cache.get(session.guildId);
  const channel = guild?.channels.cache.get(session.channelId);
  const member = channel?.members?.get(session.userId);
  const state = member?.voice;
  return Boolean(
    guild && channel && state?.channelId === session.channelId &&
    isVoiceEligible(state, settings, guild)
  );
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
  // A crash after an XP POST may leave a claim in-flight. Never replay it automatically.
  await prisma.activityRewardClaim.updateMany({
    where: {
      guildId: guild.id, periodType, status: "xp_in_flight",
      updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) }
    },
    data: { status: "pending_xp_review" }
  });
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
    if (!claim || claim.status === "delivered" || ["pending_xp_review", "xp_in_flight"].includes(claim.status)) continue;
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

    let xpDelivered = claim.xp <= 0;
    let nextStatus = !roleDelivered ? "pending_role" : "delivered";
    if (roleDelivered && claim.xp > 0) {
      const applied = await prisma.$transaction(async (tx) => {
        const xpClaim = await tx.activityRewardClaim.updateMany({ where: { id: claim.id, status: claim.status }, data: { status: "xp_in_flight" } });
        if (!xpClaim.count) return null;
        const result = await applyMemberXpInTransaction(tx, claim.userId, claim.xp);
        await tx.activityRewardClaim.update({ where: { id: claim.id }, data: { status: "delivered", deliveredAt: new Date() } });
        return result;
      });
      if (!applied) continue;
      xpDelivered = true;
      nextStatus = "delivered";
      if (applied.profile.level > applied.previousLevel && typeof guild.systemChannel?.send === "function") {
        try {
          const member = await guild.members.fetch(claim.userId).catch(() => null);
          if (member) {
            const payload = await buildRankPayload(member.user, { ...applied.profile, messages: applied.profile.totalMessages, voiceSeconds: applied.profile.totalVoiceSeconds }, { levelUp: true, previousLevel: applied.previousLevel });
            await guild.systemChannel.send(payload);
          }
        } catch (notificationError) {
          console.error("Avero activity reward level-up announcement failed for member " + claim.userId + ":", notificationError?.message ?? notificationError);
        }
      }
    }
    if (roleDelivered) {
      if (xpDelivered) nextStatus = "delivered";
      else if (nextStatus === "delivered") nextStatus = "pending_xp_retry";
    }
    await prisma.activityRewardClaim.update({
      where: { id: claim.id },
      data: { status: nextStatus, ...(nextStatus === "delivered" ? { deliveredAt: new Date() } : {}) }
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
        if (channelId && Date.now() - last >= ACTIVITY_BOARD_REFRESH_INTERVAL_MS) {
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
      const settingsByGuild = new Map();
      for (const session of sessions) {
        let settings = settingsByGuild.get(session.guildId);
        if (!settings) {
          settings = await getActivitySettings(prisma, session.guildId);
          settingsByGuild.set(session.guildId, settings);
        }
        const stillEligible = isActivityVoiceSessionEligible(client, session, settings);
        await settleVoiceSession(prisma, session, new Date(), !stillEligible);
      }
      await deliverPendingActivityXp(prisma, 25, null, client);
      await updateActivityBoards(client, prisma);
    })().catch((error) => console.error("Activity runtime tick failed:", error));
  }, 30_000);
  timer.unref?.();
  return timer;
}