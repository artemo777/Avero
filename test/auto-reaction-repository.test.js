import assert from "node:assert/strict";
import test from "node:test";
import {
  upsertAutoReactionUserPerk,
  removeAutoReactionUserPerk,
  upsertAutoReactionRolePerk,
  removeAutoReactionRolePerk
} from "../src/db/auto-reaction-repository.js";

function makePrisma() {
  const calls = [];
  return {
    calls,
    autoReactionRolePerk: {
      upsert: async (args) => { calls.push(["upsert", args]); return args.create; },
      deleteMany: async (args) => { calls.push(["deleteMany", args]); return { count: 1 }; }
    }
  };
}

test("stores and removes a personal reaction perk by guild and user", async () => {
  const prisma = makePrisma();
  const userId = "12345678901234567";
  const guildId = "22345678901234567";
  const saved = await upsertAutoReactionUserPerk(prisma, guildId, userId, "🌟");
  assert.deepEqual(saved, { guildId, userId, roleId: null, emoji: "🌟" });
  assert.deepEqual(prisma.calls[0][1].where, { guildId_userId: { guildId, userId } });
  assert.equal(await removeAutoReactionUserPerk(prisma, guildId, userId), 1);
  assert.deepEqual(prisma.calls[1][1].where, { guildId, userId });
});

test("keeps role reaction perk persistence working", async () => {
  const prisma = makePrisma();
  const roleId = "32345678901234567";
  const guildId = "42345678901234567";
  await upsertAutoReactionRolePerk(prisma, guildId, roleId, "🔥");
  assert.deepEqual(prisma.calls[0][1].where, { guildId_roleId: { guildId, roleId } });
  assert.equal(await removeAutoReactionRolePerk(prisma, guildId, roleId), 1);
});

test("rejects malformed user IDs and empty emoji values", async () => {
  const prisma = makePrisma();
  await assert.rejects(upsertAutoReactionUserPerk(prisma, "52345678901234567", "not-an-id", "🌟"), /valid Discord ID/);
  await assert.rejects(upsertAutoReactionUserPerk(prisma, "52345678901234567", "62345678901234567", " "), /non-empty string/);
});
