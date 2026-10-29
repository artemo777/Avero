import test from "node:test";
import assert from "node:assert/strict";
import { getCurrencyStats } from "../src/db/currency-repository.js";

test("currency statistics summarize wins, earnings, spending, and activity by server and member", async () => {
  let query;
  const rows = [
    { type: "guess_win", _count: { _all: 5 }, _sum: { amount: 125 } },
    { type: "guess_win_play", _count: { _all: 3 }, _sum: { amount: 0 } },
    { type: "guess_loss", _count: { _all: 2 }, _sum: { amount: 0 } },
    { type: "rps_win", _count: { _all: 4 }, _sum: { amount: 0 } },
    { type: "rps_loss", _count: { _all: 3 }, _sum: { amount: 0 } },
    { type: "rps_tie", _count: { _all: 1 }, _sum: { amount: 0 } },
    { type: "daily", _count: { _all: 2 }, _sum: { amount: 200 } },
    { type: "work", _count: { _all: 4 }, _sum: { amount: 320 } },
    { type: "scavenge", _count: { _all: 1 }, _sum: { amount: 55 } },
    { type: "shop_purchase", _count: { _all: 2 }, _sum: { amount: -450 } }
  ];
  const prisma = {
    currencyTransaction: {
      async groupBy(args) {
        query = args;
        return rows;
      }
    }
  };

  assert.deepEqual(await getCurrencyStats(prisma, "guild-1", "user-1"), {
    lifetimeEarned: 700,
    lifetimeSpent: 450,
    gameWins: 9,
    guessWins: 5,
    guessLosses: 2,
    rpsWins: 4,
    rpsLosses: 3,
    rpsTies: 1,
    gameLosses: 5,
    gameTies: 1,
    gamesPlayed: 15,
    dailyClaims: 2,
    workShifts: 4,
    scavenges: 1,
    itemsPurchased: 2
  });
  assert.deepEqual(query.where, { guildId: "guild-1", userId: "user-1" });
  assert.deepEqual(query.by, ["type"]);
});
