import test from "node:test";
import assert from "node:assert/strict";
import { deliverPendingActivityXp } from "../src/bot/activity-leaderboards.js";
import { EngaugeApiError } from "../src/bot/engauge-api.js";

const silentLogger = { error() {}, warn() {} };

function createPrisma(initialAward) {
  let status = "pending";
  const prisma = {
    activityXpAward: {
      updateMany: async ({ where, data }) => {
        if (!where.id) return { count: 0 }; // stale in-flight recovery query
        if (status !== where.status) return { count: 0 };
        status = data.status;
        return { count: 1 };
      },
      findMany: async () => status === "pending" ? [initialAward] : [],
      update: async ({ data }) => { status = data.status; return { ...initialAward, status }; }
    }
  };
  return { prisma, getStatus: () => status };
}

test("activity XP outbox marks successful Engauge awards delivered exactly once", async () => {
  const { prisma, getStatus } = createPrisma({
    id: "award-1", guildId: "12345678901234567", userId: "12345678901234568",
    source: "message", amount: 8, status: "pending"
  });
  let writes = 0;
  const api = {
    getMember: async () => ({ level: 1 }),
    addMemberXp: async (_guild, _user, amount) => { writes += 1; assert.equal(amount, 8); }
  };
  assert.equal(await deliverPendingActivityXp(prisma, 25, api, null, silentLogger), 1);
  assert.equal(getStatus(), "delivered");
  assert.equal(await deliverPendingActivityXp(prisma, 25, api, null, silentLogger), 0);
  assert.equal(writes, 1);
});

test("ambiguous Engauge failures go to manual review and are never auto-retried", async () => {
  const { prisma, getStatus } = createPrisma({
    id: "award-2", guildId: "12345678901234567", userId: "12345678901234568",
    source: "voice", amount: 8, status: "pending"
  });
  let writes = 0;
  const api = {
    getMember: async () => ({ level: 1 }),
    addMemberXp: async () => { writes += 1; throw new Error("connection lost after request"); }
  };
  assert.equal(await deliverPendingActivityXp(prisma, 25, api, null, silentLogger), 0);
  assert.equal(getStatus(), "needs_review");
  assert.equal(await deliverPendingActivityXp(prisma, 25, api, null, silentLogger), 0);
  assert.equal(writes, 1);
});


test("Engauge lookup 404 rejects an XP award without attempting the XP write", async () => {
  const { prisma, getStatus } = createPrisma({
    id: "award-404", guildId: "12345678901234567", userId: "12345678901234568",
    source: "message", amount: 8, status: "pending"
  });
  let writes = 0;
  const api = {
    getMember: async () => {
      throw new EngaugeApiError("Engauge API request failed (HTTP 404).", {
        status: 404, responseBody: "Member or server not found."
      });
    },
    addMemberXp: async () => { writes += 1; }
  };
  assert.equal(await deliverPendingActivityXp(prisma, 25, api, null, silentLogger), 0);
  assert.equal(getStatus(), "rejected");
  assert.equal(writes, 0);
});


test("successful XP delivery announces a level-up with the compact rank card", async () => {
  const { prisma, getStatus } = createPrisma({
    id: "award-level-up", guildId: "12345678901234567", userId: "12345678901234568",
    source: "message", amount: 8, status: "pending"
  });
  let level = 4;
  let announcement;
  const api = {
    getMember: async () => ({ level, xp: 1200, levelXp: 2000, messages: 80, voiceSeconds: 600 }),
    addMemberXp: async () => { level = 5; }
  };
  const author = { id: "12345678901234568", username: "Level Tester", displayAvatarURL: () => null };
  const message = {
    guildId: "12345678901234567", author,
    channel: { send: async (payload) => { announcement = payload; } }
  };
  assert.equal(await deliverPendingActivityXp(prisma, 25, api, message, silentLogger), 1);
  assert.equal(getStatus(), "delivered");
  assert.ok(announcement);
  assert.deepEqual(announcement.files.map((file) => file.name).sort(), ["avero-professor.png", "rank-card.png"]);
});
