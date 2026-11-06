import test from "node:test";
import assert from "node:assert/strict";
import { buildActivityBoardPayload } from "../src/bot/activity-leaderboards.js";
import {
  calculateActivityScore, getActivityPeriodKey, recordActivityMessage,
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
  const prisma = {
    activityBoardSetting: { upsert: async () => ({ timezone: "UTC", weeklyResetDay: 1, ignoredChannelIds: [] }) },
    $transaction: async (callback) => callback({
      activityMessageReceipt: {
        create: async ({ data }) => {
          if (receipts.has(data.messageId)) { const error = new Error("duplicate"); error.code = "P2002"; throw error; }
          receipts.add(data.messageId);
        }
      },
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
  assert.equal(stats.size, 2);
  assert.ok([...stats.values()].every((row) => row.messages === 1));
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
