import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateReputation, giveReputation, REPUTATION_COOLDOWN_MS
} from "../src/db/reputation-repository.js";

function createFakePrisma() {
  const cooldowns = new Map();
  const votes = [];
  const tx = {
    reputationCooldown: {
      async upsert({ where, create }) {
        const key = where.guildId_giverId.guildId + ":" + where.guildId_giverId.giverId;
        if (!cooldowns.has(key)) cooldowns.set(key, { ...create });
        return cooldowns.get(key);
      },
      async updateMany({ where, data }) {
        const key = where.guildId + ":" + where.giverId;
        const row = cooldowns.get(key);
        const eligible = row.lastGivenAt === null || row.lastGivenAt <= where.OR[1].lastGivenAt.lte;
        if (!eligible) return { count: 0 };
        row.lastGivenAt = data.lastGivenAt;
        return { count: 1 };
      },
      async findUnique({ where }) {
        return cooldowns.get(where.guildId_giverId.guildId + ":" + where.guildId_giverId.giverId);
      }
    },
    reputationVote: {
      async create({ data }) {
        const vote = { id: String(votes.length + 1), ...data };
        votes.push(vote);
        return vote;
      }
    }
  };
  return { votes, $transaction: (callback) => callback(tx) };
}

test("net reputation keeps positive and negative totals separate", () => {
  assert.deepEqual(calculateReputation(146, 18), { positive: 146, negative: 18, net: 128 });
});

test("invalid score inputs are normalized safely", () => {
  assert.deepEqual(calculateReputation(undefined, -4), { positive: 0, negative: 0, net: 0 });
  assert.deepEqual(calculateReputation("5", "2"), { positive: 5, negative: 2, net: 3 });
});

test("cooldown is 24 hours", () => {
  assert.equal(REPUTATION_COOLDOWN_MS, 24 * 60 * 60 * 1000);
});

test("a member can give one vote and then hits the server-scoped cooldown", async () => {
  const prisma = createFakePrisma();
  const now = new Date("2026-11-09T12:00:00.000Z");
  const first = await giveReputation(prisma, { guildId: "guild", giverId: "giver", receiverId: "one", value: 1, now });
  const second = await giveReputation(prisma, { guildId: "guild", giverId: "giver", receiverId: "two", value: 1, now: new Date(now.getTime() + 1000) });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.code, "COOLDOWN");
  assert.equal(prisma.votes.length, 1);
});

test("self-votes and reasonless negative votes are rejected", async () => {
  const prisma = createFakePrisma();
  const now = new Date("2026-11-09T12:00:00.000Z");
  await assert.rejects(
    giveReputation(prisma, { guildId: "guild", giverId: "same", receiverId: "same", value: 1, now }),
    /yourself/
  );
  await assert.rejects(
    giveReputation(prisma, { guildId: "guild", giverId: "giver", receiverId: "target", value: -1, now }),
    /short, respectful reason/
  );
  assert.equal(prisma.votes.length, 0);
});
