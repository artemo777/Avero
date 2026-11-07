import test from "node:test";
import assert from "node:assert/strict";
import { buildActivityBoardPayload } from "../src/bot/activity-leaderboards.js";
import {
  calculateActivityScore, getActivityPeriodKey, recordActivityMessage, settleVoiceSession,
  updateActivitySettings, upsertActivityRewardRule
} from "../src/db/activity-repository.js";

test("activity periods respect configured timezone and Monday weekly boundary", () => {
  const beforeMidnightUtc = new Date("2026-11-05T23:30:00.000Z");
  assert.equal(getActivityPeriodKey("daily", beforeMidnightUtc, "Europe/Stockholm"), "2026-11-06");
  assert.equal(getActivityPeriodKey("weekly", new Date("2026-11-08T12:00:00.000Z"), "UTC", 1), "2026-11-02");
  assert.equal(getActivityPeriodKey("weekly", new Date("2026-11-09T00:00:00.000Z"), "UTC", 1), "2026-11-09");
});

test("weighted activity scoring keeps raw messages and voice separate", () => {
  assert.equal(calculateActivityScore({ messages: 100, voiceSeconds: 3600 }, { messageWeight: 1.5, voiceWeight: 2 }), 270);
  assert.equal(calculateActivityScore({ messages: 0, voiceSeconds: 0 }, { messageWeight: 1, voiceWeight: 1 }), 0);
});

test("message activity records daily and weekly rows once per Discord message", async () => {
  const receipts = new Set();
  const stats = new Map();
  const xpAwards = [];
  let lastMessageXpAt = null;
  const prisma = {
    activityBoardSetting: { upsert: async () => ({ timezone: "UTC", weeklyResetDay: 1, ignoredChannelIds: [] }) },
    $transaction: async (callback) => callback({
      activityMessageReceipt: {
        create: async ({ data }) => {
          if (receipts.has(data.messageId)) { const error = new Error("duplicate"); error.code = "P2002"; throw error; }
          receipts.add(data.messageId);
        }
      },
      activityXpThrottle: {
        upsert: async () => ({}),
        updateMany: async ({ where, data }) => {
          const eligible = lastMessageXpAt === null || lastMessageXpAt <= where.OR[1].lastMessageXpAt.lte;
          if (!eligible) return { count: 0 };
          lastMessageXpAt = data.lastMessageXpAt;
          return { count: 1 };
        }
      },
      activityXpAward: { create: async ({ data }) => { xpAwards.push(data); } },
      activityStat: {
        upsert: async ({ where, create, update }) => {
          const key = [where.guildId_userId_periodType_periodKey.guildId, where.guildId_userId_periodType_periodKey.userId, where.guildId_userId_periodType_periodKey.periodType, where.guildId_userId_periodType_periodKey.periodKey].join(":");
          const current = stats.get(key);
          if (current) current.messages += update.messages.increment;
          else stats.set(key, { ...create });
        }
      }
    })
  };
  const message = { id: "message-1", guildId: "12345678901234567", channelId: "12345678901234568", author: { id: "12345678901234569", bot: false } };
  assert.equal(await recordActivityMessage(prisma, message, new Date("2026-11-06T12:00:00Z")), true);
  assert.equal(await recordActivityMessage(prisma, message, new Date("2026-11-06T12:00:00Z")), false);
  assert.equal(await recordActivityMessage(prisma, { ...message, id: "message-2" }, new Date("2026-11-06T12:00:30Z")), true);
  assert.equal(xpAwards.length, 1, "a second message inside 60 seconds must not grant XP");
  assert.equal(await recordActivityMessage(prisma, { ...message, id: "message-3" }, new Date("2026-11-06T12:01:01Z")), true);
  assert.equal(stats.size, 2);
  assert.ok([...stats.values()].every((row) => row.messages === 3));
  assert.equal(xpAwards.length, 2);
  assert.ok(xpAwards.every((award) => award.amount === 8 && award.source === "message"));
});

test("activity settings validate weights, timezone and update intervals", async () => {
  let updated;
  const prisma = {
    activityBoardSetting: {
      upsert: async () => ({}),
      update: async ({ data }) => { updated = data; return data; }
    }
  };
  await updateActivitySettings(prisma, "12345678901234567", {
    messageWeight: 1.25, voiceWeight: 2, timezone: "Europe/Stockholm", updateIntervalSeconds: 90
  });
  assert.deepEqual(updated, { messageWeight: 1.25, voiceWeight: 2, timezone: "Europe/Stockholm", updateIntervalSeconds: 90 });
  await assert.rejects(() => updateActivitySettings(prisma, "12345678901234567", { updateIntervalSeconds: 2 }), /30–900/);
  await assert.rejects(() => updateActivitySettings(prisma, "12345678901234567", { timezone: "Not/A_Zone" }), /valid IANA timezone/);
});

test("reward rules support independently configured daily and weekly placements", async () => {
  const writes = [];
  const prisma = { activityRewardRule: { upsert: async (args) => { writes.push(args); return args; } } };
  await upsertActivityRewardRule(prisma, "12345678901234567", "daily", 1, { roleId: "12345678901234568", coins: 500, xp: 100 });
  await upsertActivityRewardRule(prisma, "12345678901234567", "weekly", 2, { roleId: null, coins: 250, xp: 0 });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].create.periodType, "daily");
  assert.equal(writes[1].create.periodType, "weekly");
  await assert.rejects(() => upsertActivityRewardRule(prisma, "12345678901234567", "monthly", 1, {}), /daily or weekly/);
});


test("live leaderboard cards use a compact server-name-free layout without pinging members", () => {
  const payload = buildActivityBoardPayload("weekly", "2026-11-02", [
    { userId: "12345678901234567", score: 28.5, messages: 13, voiceSeconds: 2520 },
    { userId: "12345678901234568", score: 19, messages: 9, voiceSeconds: 1800 }
  ], { messageWeight: 1, voiceWeight: 1, weeklyResetDay: 1 });
  const rendered = payload.components[0].toJSON().components
    .filter((component) => component.type === 10)
    .map((component) => component.content)
    .join("\n");
  assert.match(rendered, /WEEKLY ACTIVITY LEADERBOARD/);
  assert.match(rendered, /Resets every Monday/);
  assert.match(rendered, /13 msg  ·  42 min VC/);
  assert.doesNotMatch(rendered, /AVERO TEST SERVER/i);
  assert.deepEqual(payload.allowedMentions, { parse: [] });
});

test("voice sessions split seconds across local midnight and weekly reset boundaries", async () => {
  const rows = new Map();
  const xpAwards = [];
  const sessionStart = new Date("2026-11-08T22:59:30.000Z"); // Sunday 23:59:30 in Stockholm
  const now = new Date("2026-11-08T23:01:30.000Z"); // Monday 00:01:30 in Stockholm
  const prisma = {
    $transaction: async (callback) => callback({
      activityVoiceSession: {
        updateMany: async () => ({ count: 1 }),
        deleteMany: async () => ({ count: 1 })
      },
      activityXpAward: { create: async ({ data }) => { xpAwards.push(data); } },
      activityBoardSetting: {
        upsert: async () => ({ timezone: "Europe/Stockholm", weeklyResetDay: 1 })
      },
      activityStat: {
        upsert: async ({ where, create, update }) => {
          const key = where.guildId_userId_periodType_periodKey.periodType + ":" + where.guildId_userId_periodType_periodKey.periodKey;
          const row = rows.get(key) ?? { ...create };
          if (rows.has(key)) row.voiceSeconds += update.voiceSeconds.increment;
          rows.set(key, row);
        }
      }
    })
  };
  await settleVoiceSession(prisma, {
    id: "voice-session-1",
    guildId: "12345678901234567",
    userId: "12345678901234569",
    lastSettledAt: sessionStart,
    xpRemainderSeconds: 0,
    xpMinutesAwarded: 0
  }, now, true);
  assert.equal(rows.get("daily:2026-11-08").voiceSeconds, 30);
  assert.equal(rows.get("daily:2026-11-09").voiceSeconds, 90);
  assert.equal(rows.get("weekly:2026-11-02").voiceSeconds, 30);
  assert.equal(rows.get("weekly:2026-11-09").voiceSeconds, 90);
  assert.equal(xpAwards.length, 2);
  assert.deepEqual(xpAwards.map((award) => award.amount), [8, 8]);
  assert.deepEqual(xpAwards.map((award) => award.source), ["voice", "voice"]);
});
