import test from "node:test";
import assert from "node:assert/strict";
import { deliverPendingActivityXp } from "../src/bot/activity-leaderboards.js";

const silentLogger = { error() {} };
function createPrisma(initialAward, initialProfile = { xp: 992, level: 0, nextLevelXp: 1000, totalMessages: 0, totalVoiceSeconds: 0 }) {
  let status = "pending", profile = { ...initialProfile };
  const prisma = {
    activityXpAward: { findMany: async () => status === "pending" ? [initialAward] : [] },
    $transaction: async (fn) => fn({
      activityXpAward: {
        updateMany: async ({ where, data }) => { if (status !== where.status) return { count: 0 }; status = data.status; return { count: 1 }; },
        update: async ({ data }) => { status = data.status; return { ...initialAward, status }; }
      },
      memberProfile: {
        upsert: async ({ create, update }) => { profile = profile ? { ...profile, xp: profile.xp + update.xp.increment } : { ...create }; return { ...profile }; },
        update: async ({ data }) => { profile = { ...profile, ...data }; return { ...profile }; }
      }
    })
  };
  return { prisma, getStatus: () => status, getProfile: () => profile };
}
const award = { id: "award-1", guildId: "12345678901234567", userId: "12345678901234568", source: "message", amount: 8, status: "pending" };

test("activity XP is committed to Avero's own profile exactly once", async () => {
  const { prisma, getStatus, getProfile } = createPrisma(award);
  assert.equal(await deliverPendingActivityXp(prisma, 25, null, null, silentLogger), 1);
  assert.equal(getStatus(), "delivered");
  assert.equal(getProfile().xp, 1000);
  assert.equal(getProfile().level, 1);
  assert.equal(getProfile().nextLevelXp, 2000);
  assert.equal(await deliverPendingActivityXp(prisma, 25, null, null, silentLogger), 0);
  assert.equal(getProfile().xp, 1000);
});

test("a failed local XP transaction leaves the outbox entry safely pending", async () => {
  const { prisma, getStatus } = createPrisma(award);
  prisma.$transaction = async () => { throw new Error("database unavailable"); };
  assert.equal(await deliverPendingActivityXp(prisma, 25, null, null, silentLogger), 0);
  assert.equal(getStatus(), "pending");
});

test("level-up delivery still posts the Avero rank card", async () => {
  const { prisma } = createPrisma(award);
  let announcement;
  const author = { id: award.userId, username: "Level Tester", displayAvatarURL: () => null };
  const message = { guildId: award.guildId, author, channel: { send: async (payload) => { announcement = payload; } } };
  await deliverPendingActivityXp(prisma, 25, null, message, silentLogger);
  assert.ok(announcement);
  assert.deepEqual(announcement.files.map((file) => file.name).sort(), ["avero-professor.png", "rank-card.png"]);
});
