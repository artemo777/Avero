import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureMemberProfile,
  getMemberProfile
} from "../src/db/member-repository.js";

test("member repository looks up a profile by guild and user", async () => {
  const expected = { guildId: "guild-1", userId: "user-1", xp: 20 };
  let received;
  const prisma = {
    memberProfile: {
      findUnique: async (args) => {
        received = args;
        return expected;
      }
    }
  };

  assert.equal(await getMemberProfile(prisma, " guild-1 ", " user-1 "), expected);
  assert.deepEqual(received, {
    where: { guildId_userId: { guildId: "guild-1", userId: "user-1" } }
  });
});

test("ensure member profile creates missing profiles without resetting existing data", async () => {
  let received;
  const profile = { guildId: "guild-1", userId: "user-1", xp: 40 };
  const prisma = {
    memberProfile: {
      upsert: async (args) => {
        received = args;
        return profile;
      }
    }
  };

  assert.equal(await ensureMemberProfile(prisma, "guild-1", "user-1"), profile);
  assert.deepEqual(received, {
    where: { guildId_userId: { guildId: "guild-1", userId: "user-1" } },
    create: { guildId: "guild-1", userId: "user-1" },
    update: {}
  });
});

test("member repository rejects missing identifiers before querying", async () => {
  const prisma = { memberProfile: { findUnique: async () => assert.fail("should not query database") } };
  await assert.rejects(getMemberProfile(prisma, "", "user-1"), /guildId must be a non-empty string/);
});
