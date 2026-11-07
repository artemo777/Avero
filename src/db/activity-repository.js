const PERIOD_TYPES = new Set(["daily", "weekly"]);
const ROLE_ID = /^\d{17,20}$/;
const DEFAULTS = Object.freeze({
  dailyChannelId: null, dailyMessageId: null, weeklyChannelId: null, weeklyMessageId: null,
  messageWeight: 1, voiceWeight: 1, timezone: "UTC", weeklyResetDay: 1,
  updateIntervalSeconds: 300, voiceMinParticipants: 2, ignoredChannelIds: []
});
function validGuildId(value) {
  if (typeof value !== "string" || !/^\d{17,20}$/.test(value)) throw new TypeError("A valid guild ID is required.");
  return value;
}
export function validateTimezone(timezone) {
  if (typeof timezone !== "string" || timezone.length > 80) throw new TypeError("Timezone must be a valid IANA timezone.");
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date()); }
  catch { throw new TypeError("Use a valid IANA timezone, such as Europe/Stockholm."); }
  return timezone;
}
function localDate(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")) };
}
function dateKey({ year, month, day }) {
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}
export function getActivityPeriodKey(periodType, date = new Date(), timezone = "UTC", weeklyResetDay = 1) {
  if (!PERIOD_TYPES.has(periodType)) throw new TypeError("Period must be daily or weekly.");
  validateTimezone(timezone);
  const parts = localDate(date, timezone);
  if (periodType === "daily") return dateKey(parts);
  if (!Number.isInteger(weeklyResetDay) || weeklyResetDay < 0 || weeklyResetDay > 6) throw new RangeError("Weekly reset day must be 0–6.");
  const localMidnight = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const delta = (localMidnight.getUTCDay() - weeklyResetDay + 7) % 7;
  localMidnight.setUTCDate(localMidnight.getUTCDate() - delta);
  return dateKey({ year: localMidnight.getUTCFullYear(), month: localMidnight.getUTCMonth() + 1, day: localMidnight.getUTCDate() });
}
export function calculateActivityScore(stat, settings) {
  const messages = Math.max(0, Number(stat.messages) || 0);
  const voiceMinutes = Math.max(0, Number(stat.voiceSeconds) || 0) / 60;
  return messages * settings.messageWeight + voiceMinutes * settings.voiceWeight;
}
export async function getActivitySettings(prisma, guildId) {
  const key = validGuildId(guildId);
  return prisma.activityBoardSetting.upsert({
    where: { guildId: key }, create: { guildId: key, ...DEFAULTS }, update: {}
  });
}
export async function updateActivitySettings(prisma, guildId, input) {
  const key = validGuildId(guildId);
  const allowed = new Set(["dailyChannelId", "weeklyChannelId", "messageWeight", "voiceWeight", "timezone", "weeklyResetDay", "updateIntervalSeconds", "voiceMinParticipants", "ignoredChannelIds"]);
  const data = {};
  for (const [field, value] of Object.entries(input ?? {})) {
    if (!allowed.has(field)) throw new TypeError("Unsupported activity setting: " + field);
    if (field.endsWith("ChannelId")) {
      if (value !== null && (typeof value !== "string" || !/^\d{17,20}$/.test(value))) throw new TypeError(field + " must be a valid channel ID or blank.");
      data[field] = value;
    } else if (["messageWeight", "voiceWeight"].includes(field)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1000) throw new RangeError(field + " must be between 0 and 1000.");
      data[field] = value;
    } else if (field === "timezone") data[field] = validateTimezone(value);
    else if (field === "weeklyResetDay") {
      if (!Number.isInteger(value) || value < 0 || value > 6) throw new RangeError("Weekly reset day must be 0–6.");
      data[field] = value;
    } else if (field === "updateIntervalSeconds") {
      if (!Number.isInteger(value) || value < 30 || value > 900) throw new RangeError("Update interval must be 30–900 seconds.");
      data[field] = value;
    } else if (field === "voiceMinParticipants") {
      if (!Number.isInteger(value) || value < 2 || value > 99) throw new RangeError("Voice participants must be between 2 and 99.");
      data[field] = value;
    } else if (field === "ignoredChannelIds") {
      if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !/^\d{17,20}$/.test(id))) throw new TypeError("Ignored channels must be valid channel IDs.");
      data[field] = [...new Set(value)];
    }
  }
  if (!Object.keys(data).length) throw new TypeError("No activity settings were supplied.");
  await getActivitySettings(prisma, key);
  return prisma.activityBoardSetting.update({ where: { guildId: key }, data });
}
export async function recordActivityMessage(prisma, message, now = new Date()) {
  if (!message?.guildId || !message?.author?.id || message.author.bot || message.webhookId) return false;
  const settings = await getActivitySettings(prisma, message.guildId);
  if (settings.ignoredChannelIds.includes(message.channelId)) return false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.activityMessageReceipt.create({ data: { messageId: message.id, guildId: message.guildId, userId: message.author.id } });
      for (const periodType of ["daily", "weekly"]) {
        const periodKey = getActivityPeriodKey(periodType, now, settings.timezone, settings.weeklyResetDay);
        await tx.activityStat.upsert({
          where: { guildId_userId_periodType_periodKey: { guildId: message.guildId, userId: message.author.id, periodType, periodKey } },
          create: { guildId: message.guildId, userId: message.author.id, periodType, periodKey, messages: 1 },
          update: { messages: { increment: 1 } }
        });
      }
      // Match Engauge's configured one-message-per-60-second XP cooldown.
      await tx.activityXpThrottle.upsert({
        where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } },
        create: { guildId: message.guildId, userId: message.author.id },
        update: {}
      });
      const xpWindow = new Date(now.getTime() - 60_000);
      const xpClaim = await tx.activityXpThrottle.updateMany({
        where: {
          guildId: message.guildId,
          userId: message.author.id,
          OR: [{ lastMessageXpAt: null }, { lastMessageXpAt: { lte: xpWindow } }]
        },
        data: { lastMessageXpAt: now }
      });
      if (xpClaim.count) {
        await tx.activityXpAward.create({
          data: {
            dedupeKey: "message:" + message.guildId + ":" + message.author.id + ":" + now.toISOString(),
            guildId: message.guildId, userId: message.author.id, source: "message", amount: 8
          }
        });
      }
    });
    return true;
  } catch (error) {
    if (error?.code === "P2002") return false;
    throw error;
  }
}
export async function upsertVoiceSession(prisma, guildId, userId, channelId, now = new Date()) {
  return prisma.activityVoiceSession.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId, channelId, lastSettledAt: now },
    update: { channelId, lastSettledAt: now }
  });
}
function buildVoicePeriodBuckets(start, seconds, settings) {
  if (seconds <= 0) return [];
  const first = new Date(start);
  const last = new Date(first.getTime() + (seconds - 1) * 1000);
  const keyAt = (date) => ({
    daily: getActivityPeriodKey("daily", date, settings.timezone, settings.weeklyResetDay),
    weekly: getActivityPeriodKey("weekly", date, settings.timezone, settings.weeklyResetDay)
  });
  const firstKeys = keyAt(first);
  const lastKeys = keyAt(last);
  if (firstKeys.daily === lastKeys.daily && firstKeys.weekly === lastKeys.weekly) {
    return [{ ...firstKeys, seconds }];
  }
  // Only intervals that cross a reset boundary need per-second bucketing.
  // Normal 30-second settlements take the constant-time path above.
  const buckets = new Map();
  for (let offset = 0; offset < seconds; offset += 1) {
    const keys = keyAt(new Date(first.getTime() + offset * 1000));
    const id = keys.daily + "|" + keys.weekly;
    const bucket = buckets.get(id) ?? { ...keys, seconds: 0 };
    bucket.seconds += 1;
    buckets.set(id, bucket);
  }
  return [...buckets.values()];
}
export async function settleVoiceSession(prisma, session, now = new Date(), close = false) {
  const elapsedMs = Math.max(0, Math.min(now.getTime() - session.lastSettledAt.getTime(), 120_000));
  const seconds = Math.floor(elapsedMs / 1000);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.activityVoiceSession.updateMany({
      where: { guildId: session.guildId, userId: session.userId, lastSettledAt: session.lastSettledAt },
      data: { lastSettledAt: now }
    });
    if (!claimed.count) return;
    if (seconds > 0) {
      const settings = await getActivitySettings(tx, session.guildId);
      const buckets = buildVoicePeriodBuckets(session.lastSettledAt, seconds, settings);
      for (const bucket of buckets) {
        for (const [periodType, periodKey] of [["daily", bucket.daily], ["weekly", bucket.weekly]]) {
          await tx.activityStat.upsert({
            where: { guildId_userId_periodType_periodKey: { guildId: session.guildId, userId: session.userId, periodType, periodKey } },
            create: { guildId: session.guildId, userId: session.userId, periodType, periodKey, voiceSeconds: bucket.seconds },
            update: { voiceSeconds: { increment: bucket.seconds } }
          });
        }
      }
      // Keep sub-minute eligible time across disconnects and channel changes.
      const progress = await tx.activityXpThrottle.upsert({
        where: { guildId_userId: { guildId: session.guildId, userId: session.userId } },
        create: { guildId: session.guildId, userId: session.userId },
        update: {}
      });
      const priorRemainder = progress.voiceRemainderSeconds ?? 0;
      const priorMinutesAwarded = progress.voiceMinutesAwarded ?? 0;
      const totalXpSeconds = priorRemainder + seconds;
      const earnedVoiceMinutes = Math.floor(totalXpSeconds / 60);
      const nextRemainder = totalXpSeconds % 60;
      const progressClaim = await tx.activityXpThrottle.updateMany({
        where: {
          guildId: session.guildId, userId: session.userId,
          voiceRemainderSeconds: priorRemainder, voiceMinutesAwarded: priorMinutesAwarded
        },
        data: {
          voiceRemainderSeconds: nextRemainder,
          voiceMinutesAwarded: { increment: earnedVoiceMinutes }
        }
      });
      if (!progressClaim.count) throw new Error("Voice XP progress changed concurrently; settlement rolled back.");
      for (let minute = 1; minute <= earnedVoiceMinutes; minute += 1) {
        const sequence = priorMinutesAwarded + minute;
        await tx.activityXpAward.create({
          data: {
            dedupeKey: "voice:" + session.guildId + ":" + session.userId + ":" + sequence,
            guildId: session.guildId, userId: session.userId, source: "voice", amount: 8
          }
        });
      }
    }
    if (close) await tx.activityVoiceSession.deleteMany({ where: { guildId: session.guildId, userId: session.userId, lastSettledAt: now } });
  });
}
export async function getActivityRanking(prisma, guildId, periodType, periodKey, settings, take = 10) {
  const rows = await prisma.activityStat.findMany({ where: { guildId, periodType, periodKey } });
  return rows.map((row) => ({ ...row, score: calculateActivityScore(row, settings) }))
    .sort((a, b) => b.score - a.score || b.messages - a.messages || b.voiceSeconds - a.voiceSeconds || a.userId.localeCompare(b.userId))
    .slice(0, take);
}
export async function upsertActivityRewardRule(prisma, guildId, periodType, position, values) {
  validGuildId(guildId);
  if (!PERIOD_TYPES.has(periodType)) throw new TypeError("Reward period must be daily or weekly.");
  if (!Number.isInteger(position) || position < 1 || position > 10) throw new RangeError("Reward placement must be 1–10.");
  const roleId = values.roleId || null;
  if (roleId !== null && !ROLE_ID.test(roleId)) throw new TypeError("Reward role ID is invalid.");
  const coins = Number(values.coins ?? 0), xp = Number(values.xp ?? 0);
  if (!Number.isSafeInteger(coins) || coins < 0 || coins > 1_000_000) throw new RangeError("Coin reward must be 0–1,000,000.");
  if (!Number.isSafeInteger(xp) || xp < 0 || xp > 1_000_000) throw new RangeError("XP reward must be 0–1,000,000.");
  const enabled = Boolean(values.enabled ?? true);
  return prisma.activityRewardRule.upsert({
    where: { guildId_periodType_position: { guildId, periodType, position } },
    create: { guildId, periodType, position, roleId, coins, xp, enabled },
    update: { roleId, coins, xp, enabled }
  });
}
export { DEFAULTS as ACTIVITY_SETTING_DEFAULTS };