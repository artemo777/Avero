import test from "node:test";
import assert from "node:assert/strict";
import {
  experienceForLevel,
  levelForExperience,
  recordMessageExperience
} from "../src/db/member-repository.js";
import {
  grantLevelRoleRewards,
  parseLevelRoleRewards,
  randomMessageExperience
} from "../src/bot/leveling.js";

function makePrisma(initialProfile) {
  let profile = { ...initialProfile };
  return {
    memberProfile: {
      upsert: async () => profile,
      findUnique: async () => ({ ...profile }),
      updateMany: async ({ where, data }) => {
        const cutoff = where.OR[1].lastMessageXpAt.lte;
        const eligible = profile.lastMessageXpAt === null || profile.lastMessageXpAt <= cutoff;
        if (!eligible) return { count: 0 };
        profile.xp += data.xp.increment;
        profile.lastMessageXpAt = data.lastMessageXpAt;
        return { count: 1 };
      },
      update: async ({ data }) => {
        profile = { ...profile, ...data };
        return { ...profile };
      }
    },
    read: () => ({ ...profile })
  };
}

test("level thresholds use the documented square progression", () => {
  assert.equal(experienceForLevel(0), 0);
  assert.equal(experienceForLevel(1), 100);
  assert.equal(experienceForLevel(2), 400);
  assert.equal(levelForExperience(0), 0);
  assert.equal(levelForExperience(99), 0);
  assert.equal(levelForExperience(100), 1);
  assert.equal(levelForExperience(399), 1);
  assert.equal(levelForExperience(400), 2);
});

test("message XP is awarded once per cooldown and updates the level", async () => {
  const now = new Date("2026-10-27T12:00:00.000Z");
  const prisma = makePrisma({
    guildId: "guild-1",
    userId: "user-1",
    xp: 90,
    level: 0,
    lastMessageXpAt: null
  });

  const first = await recordMessageExperience(prisma, "guild-1", "user-1", {
    amount: 15,
    cooldownMs: 60_000,
    now
  });
  assert.equal(first.awarded, true);
  assert.equal(first.previousLevel, 0);
  assert.equal(first.profile.xp, 105);
  assert.equal(first.profile.level, 1);

  const second = await recordMessageExperience(prisma, "guild-1", "user-1", {
    amount: 20,
    cooldownMs: 60_000,
    now: new Date(now.getTime() + 10_000)
  });
  assert.equal(second.awarded, false);
  assert.equal(prisma.read().xp, 105);
});

test("message XP validates amount and cooldown", async () => {
  const prisma = makePrisma({
    guildId: "guild-1",
    userId: "user-1",
    xp: 0,
    level: 0,
    lastMessageXpAt: null
  });
  await assert.rejects(
    recordMessageExperience(prisma, "guild-1", "user-1", { amount: 0 }),
    /positive safe integer/
  );
  await assert.rejects(
    recordMessageExperience(prisma, "guild-1", "user-1", { amount: 5, cooldownMs: -1 }),
    /non-negative safe integer/
  );
});

test("message XP rolls random values into the inclusive 15–25 range", () => {
  assert.equal(randomMessageExperience(() => 0), 15);
  assert.equal(randomMessageExperience(() => 0.999999), 25);
});

test("role reward configuration validates milestone levels and role IDs", () => {
  assert.deepEqual(parseLevelRoleRewards('{"5":"123456789012345678"}'), {
    5: "123456789012345678"
  });
  assert.deepEqual(parseLevelRoleRewards(""), {});
  assert.throws(() => parseLevelRoleRewards("not-json"), /JSON object/);
  assert.throws(() => parseLevelRoleRewards('{"0":"123456789012345678"}'), /positive level/);
  assert.throws(() => parseLevelRoleRewards('{"5":"not-a-role"}'), /role IDs/);
});

test("milestone roles are granted only for crossed milestones", async () => {
  const granted = [];
  const role = { id: "123456789012345678" };
  const member = {
    guild: { roles: { cache: new Map([[role.id, role]]) } },
    roles: {
      cache: new Set(),
      add: async (value) => { granted.push(value.id); }
    }
  };

  const levels = await grantLevelRoleRewards(member, 4, 6, {
    3: "234567890123456789",
    5: role.id,
    10: "345678901234567890"
  });
  assert.deepEqual(levels, [5]);
  assert.deepEqual(granted, [role.id]);
});
