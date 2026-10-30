import test from "node:test";
import assert from "node:assert/strict";
import { leaderboardCommand } from "../src/bot/commands/leaderboard.js";

test("Vault leaderboard ranks server members by vault wins and records losses", async () => {
  let response;
  const prisma = {
    currencyTransaction: {
      groupBy: async ({ where }) => {
        assert.equal(where.guildId, "guild-1");
        assert.deepEqual(where.type.in, ["vault_win", "vault_loss"]);
        return [
          { userId: "user-1", type: "vault_win", _count: { _all: 3 } },
          { userId: "user-1", type: "vault_loss", _count: { _all: 2 } },
          { userId: "user-2", type: "vault_win", _count: { _all: 1 } }
        ];
      }
    }
  };
  await leaderboardCommand.execute({
    guildId: "guild-1",
    options: { getString: () => "vault" },
    reply: async (payload) => { response = payload; }
  }, { prisma });

  assert.equal(response.embeds[0].title, "🔐 Vault leaderboard");
  assert.match(response.embeds[0].description, /<@user-1> — \*\*3W \/ 2L · 60% win rate\*\*/);
  assert.match(response.embeds[0].description, /<@user-2> — \*\*1W \/ 0L · 100% win rate\*\*/);
});
