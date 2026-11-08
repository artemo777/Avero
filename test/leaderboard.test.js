import test from "node:test";
import assert from "node:assert/strict";
import { leaderboardCommand } from "../src/bot/commands/leaderboard.js";
function panelText(response) { return response.components[0].toJSON().components.filter((item) => item.type === 10).map((item) => item.content).join("\n"); }

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
    guildId: "__avero_global__",
    options: { getString: () => "games" },
    reply: async (payload) => { response = payload; }
  }, { prisma });

  assert.deepEqual(query.where, {
    guildId: "__avero_global__",
    type: { in: ["guess_win_play", "guess_win", "guess_loss", "rps_win", "rps_loss", "rps_tie", "vault_win", "vault_loss", "coinflip_win", "coinflip_loss"] }
  });
  assert.match(panelText(response), /<@user-1> — \*\*12W \/ 5L \/ 1T · 67% win rate\*\*/);
  assert.match(panelText(response), /<@user-2> — \*\*4W \/ 3L \/ 0T · 57% win rate\*\*/);
  assert.ok(panelText(response).indexOf("<@user-1>") < panelText(response).indexOf("<@user-2>"));
  assert.deepEqual(response.allowedMentions, { parse: [] });
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
      guildId: "__avero_global__",
      options: { getString: () => category },
      reply: async (payload) => { replies.push(payload); }
    }, { prisma });
  }

  assert.deepEqual(queries[0].where.type.in, ["guess_win_play", "guess_win", "guess_loss"]);
  assert.deepEqual(queries[1].where.type.in, ["rps_win", "rps_loss", "rps_tie"]);
  assert.match(panelText(replies[0]), /8W \/ 2L · 80% win rate/);
  assert.match(panelText(replies[1]), /2W \/ 1L \/ 1T · 50% win rate/);
});


test("Engauge XP leaderboard uses paginated server member data", async () => {
  let requested;
  let response;
  await leaderboardCommand.execute({
    guildId: "12345678901234567",
    options: { getString: () => "xp" },
    reply: async (payload) => { response = payload; }
  }, {
    prisma: {},
    engaugeClient: {
      async getAllMembers(serverId, options) {
        requested = { serverId, options };
        return [
          { id: "12345678901234568", xp: "20662", level: 99 },
          { id: "12345678901234569", xp: "15000", level: 80 }
        ];
      }
    }
  });
  assert.deepEqual(requested, {
    serverId: "12345678901234567",
    options: { order: "xp", direction: "desc" }
  });
  assert.match(panelText(response), /<@12345678901234568> — \*\*20,662 XP\*\*/);
  assert.match(panelText(response), /<@12345678901234569> — \*\*15,000 XP\*\*/);
  assert.deepEqual(response.allowedMentions, { parse: [] });
});

test("Engauge voice leaderboard displays voice minutes from server member data", async () => {
  let response;
  await leaderboardCommand.execute({
    guildId: "12345678901234567",
    options: { getString: () => "voice" },
    reply: async (payload) => { response = payload; }
  }, {
    prisma: {},
    engaugeClient: {
      async getAllMembers(_serverId, options) {
        assert.equal(options.order, "voice");
        return [{ id: "12345678901234568", voiceSeconds: 7260 }];
      }
    }
  });
  assert.match(panelText(response), /2,? 121 voice minutes|121 voice minutes/);
});
