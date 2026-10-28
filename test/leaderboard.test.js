import test from "node:test";
import assert from "node:assert/strict";
import { leaderboardCommand } from "../src/bot/commands/leaderboard.js";

function makeInteraction({ guildId = "guild-1", profiles = [] } = {}) {
  let response;
  const interaction = {
    guildId,
    reply: async (payload) => { response = payload; }
  };
  const calls = [];
  const prisma = {
    memberProfile: {
      findMany: async (args) => {
        calls.push(args);
        return profiles;
      }
    }
  };
  return { interaction, prisma, calls, getResponse: () => response };
}

test("leaderboard ranks XP in descending order and scopes the query to the current server", async () => {
  const { interaction, prisma, calls, getResponse } = makeInteraction({
    guildId: "guild-42",
    profiles: [
      { userId: "user-2", xp: 900 },
      { userId: "user-1", xp: 250 }
    ]
  });

  await leaderboardCommand.execute(interaction, { prisma });

  assert.deepEqual(calls, [{
    where: { guildId: "guild-42" },
    orderBy: [{ xp: "desc" }, { userId: "asc" }],
    take: 10
  }]);
  const embed = getResponse().embeds[0];
  assert.match(embed.title, /Server leaderboard/);
  assert.match(embed.description, /1\. <@user-2> — Level 3 · 900 XP/);
  assert.match(embed.description, /2\. <@user-1> — Level 1 · 250 XP/);
  assert.match(embed.footer.text, /This server only/);
});

test("leaderboard gives a helpful empty state", async () => {
  const { interaction, prisma, getResponse } = makeInteraction();

  await leaderboardCommand.execute(interaction, { prisma });

  assert.match(getResponse().embeds[0].description, /No one has earned XP here yet/);
});

test("leaderboard rejects direct messages with an ephemeral reply", async () => {
  const { interaction, prisma, getResponse } = makeInteraction({ guildId: null });

  await leaderboardCommand.execute(interaction, { prisma });

  assert.deepEqual(getResponse(), {
    content: "The leaderboard can only be used in a server.",
    ephemeral: true
  });
});
