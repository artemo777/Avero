import test from "node:test";
import assert from "node:assert/strict";
import { deliverPendingActivityXp } from "../src/bot/activity-leaderboards.js";

const silentLogger = { error() {}, warn() {} };
const guildId = "12345678901234567";
const userId = "12345678901234568";

function createPrisma(initialAward, initialProgress = null) {
  let awardStatus = "pending";
  let progress = initialProgress ? { id: "progress-1", guildId, userId, xp: 0, totalXp: 0, level: 0, nextLevelXp: 1000, messages: 0, voiceSeconds: 0, currency: 0, ...initialProgress } : null;
  const awards = {
    updateMany: async ({ where, data }) => {
      if (!where.id) return { count: 0 };
      if (awardStatus !== where.status) return { count: 0 };
      awardStatus = data.status;
      return { count: 1 };
    },
    findMany: async () => awardStatus === "pending" ? [initialAward] : [],
    update: async ({ data }) => { awardStatus = data.status; return { ...initialAward, status: awardStatus }; }
  };
  const progression = {
    findUnique: async () => progress,
    upsert: async ({ create, update }) => {
      if (!progress) progress = { id: "progress-1", nextLevelXp: 1000, level: 0, xp: 0, totalXp: 0, messages: 0, voiceSeconds: 0, currency: 0, ...create };
      else {
        if (update.xp?.increment) progress.xp += update.xp.increment;
        if (update.totalXp?.increment) progress.totalXp += update.totalXp.increment;
      }
      return progress;
    },
    updateMany: async ({ where, data }) => {
      if (!progress || progress.id !== where.id || progress.xp !== where.xp || progress.level !== where.level || progress.nextLevelXp !== where.nextLevelXp) return { count: 0 };
      progress.xp -= data.xp.decrement;
      progress.level += data.level.increment;
      progress.nextLevelXp = data.nextLevelXp;
      return { count: 1 };
    }
  };
  const tx = { activityXpAward: awards, guildMemberProgress: progression };
  return {
    prisma: { ...tx, $transaction: async (callback) => callback(tx) },
    getStatus: () => awardStatus,
    getProgress: () => progress
  };
}

test("activity XP outbox writes natively to Avero and delivers each award once", async () => {
  const { prisma, getStatus, getProgress } = createPrisma({
    id: "award-1", guildId, userId, source: "message", amount: 8, status: "pending"
  });
  assert.equal(await deliverPendingActivityXp(prisma, 25, null, null, silentLogger), 1);
  assert.equal(getStatus(), "delivered");
  assert.equal(getProgress().xp, 8);
  assert.equal(getProgress().totalXp, 8);
  assert.equal(await deliverPendingActivityXp(prisma, 25, null, null, silentLogger), 0);
  assert.equal(getProgress().totalXp, 8);
});

test("native activity XP updates Avero level progress and announces level-ups", async () => {
  const { prisma, getStatus, getProgress } = createPrisma({
    id: "award-level-up", guildId, userId, source: "message", amount: 8, status: "pending"
  }, { level: 4, xp: 1996, totalXp: 9996, nextLevelXp: 2000 });
  let announcement;
  const author = { id: userId, username: "Level Tester", displayAvatarURL: () => null };
  const message = { guildId, author, channel: { send: async (payload) => { announcement = payload; } } };
  assert.equal(await deliverPendingActivityXp(prisma, 25, null, message, silentLogger), 1);
  assert.equal(getStatus(), "delivered");
  assert.equal(getProgress().level, 5);
  assert.equal(getProgress().xp, 4);
  assert.ok(announcement);
  assert.deepEqual(announcement.files.map((file) => file.name).sort(), ["avero-professor.png", "rank-card.png"]);
});
