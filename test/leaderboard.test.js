import test from "node:test";
import assert from "node:assert/strict";
import { leaderboardCommand } from "../src/bot/commands/leaderboard.js";

test("games leaderboard includes legacy guess wins without double-counting new results", async () => {
  let query;
  let response;
  const prisma = {
    currencyTransaction: {
      async groupBy(args) {
        query = args;
        return [
          { userId: "user-1", type: "guess_win_play", _count: { _all: 3 } },
          { userId: "user-1", type: "guess_win", _count: { _all: 5 } },
          { userId: "user-1", type: "guess_loss", _count: { _all: 2 } },
          { userId: "user-1", type: "rps_win", _count: { _all: 4 } },
          { userId: "user-1", type: "rps_loss", _count: { _all: 3 } },
          { userId: "user-1", type: "rps_tie", _count: { _all: 1 } },
          { userId: "user-2", type: "guess_win_play", _count: { _all: 2 } },
          { userId: "user-2", type: "guess_win", _count: { _all: 2 } },
          { userId: "user-2", type: "guess_loss", _count: { _all: 3 } }
        ];
      }
    }
  };
  await leaderboardCommand.execute({
    guildId: "guild-1",
    options: { getString: () => "games" },
    reply: async (payload) => { response = payload; }
  }, { prisma });

  assert.deepEqual(query.where, {
    guildId: "guild-1",
    type: { in: ["guess_win_play", "guess_win", "guess_loss", "rps_win", "rps_loss", "rps_tie"] }
  });
  assert.match(response.embeds[0].description, /<@user-1> — \*\*9W \/ 5L \/ 1T · 60% win rate\*\*/);
  assert.match(response.embeds[0].description, /<@user-2> — \*\*2W \/ 3L \/ 0T · 40% win rate\*\*/);
  assert.ok(response.embeds[0].description.indexOf("<@user-1>") < response.embeds[0].description.indexOf("<@user-2>"));
});
