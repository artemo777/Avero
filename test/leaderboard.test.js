import test from "node:test";
import assert from "node:assert/strict";
import { leaderboardCommand } from "../src/bot/commands/leaderboard.js";

test("games leaderboard adds legacy guess wins and all new wins exactly once", async () => {
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
    type: { in: ["guess_win_play", "guess_win", "guess_loss", "rps_win", "rps_loss", "rps_tie", "vault_win", "vault_loss"] }
  });
  assert.match(response.embeds[0].description, /<@user-1> — \*\*12W \/ 5L \/ 1T · 67% win rate\*\*/);
  assert.match(response.embeds[0].description, /<@user-2> — \*\*4W \/ 3L \/ 0T · 57% win rate\*\*/);
  assert.ok(response.embeds[0].description.indexOf("<@user-1>") < response.embeds[0].description.indexOf("<@user-2>"));
});


test("guess and RPS leaderboards filter to their own game records", async () => {
  const queries = [];
  const replies = [];
  const prisma = {
    currencyTransaction: {
      async groupBy(args) {
        queries.push(args);
        if (args.where.type.in.includes("guess_win_play")) {
          return [
            { userId: "guesser", type: "guess_win_play", _count: { _all: 3 } },
            { userId: "guesser", type: "guess_win", _count: { _all: 5 } },
            { userId: "guesser", type: "guess_loss", _count: { _all: 2 } }
          ];
        }
        return [
          { userId: "rps-player", type: "rps_win", _count: { _all: 2 } },
          { userId: "rps-player", type: "rps_loss", _count: { _all: 1 } },
          { userId: "rps-player", type: "rps_tie", _count: { _all: 1 } }
        ];
      }
    }
  };
  for (const category of ["guess", "rps"]) {
    await leaderboardCommand.execute({
      guildId: "guild-1",
      options: { getString: () => category },
      reply: async (payload) => { replies.push(payload); }
    }, { prisma });
  }

  assert.deepEqual(queries[0].where.type.in, ["guess_win_play", "guess_win", "guess_loss"]);
  assert.deepEqual(queries[1].where.type.in, ["rps_win", "rps_loss", "rps_tie"]);
  assert.match(replies[0].embeds[0].description, /8W \/ 2L · 80% win rate/);
  assert.match(replies[1].embeds[0].description, /2W \/ 1L \/ 1T · 50% win rate/);
});
