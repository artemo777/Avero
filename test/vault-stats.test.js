import test from "node:test";
import assert from "node:assert/strict";
import { getCurrencyStats } from "../src/db/currency-repository.js";

test("vault wins and losses contribute to lifetime game stats", async () => {
  const prisma = {
    currencyTransaction: {
      groupBy: async () => [
        { type: "vault_win", _count: { _all: 2 }, _sum: { amount: 0 } },
        { type: "vault_loss", _count: { _all: 3 }, _sum: { amount: 0 } },
        { type: "vault_reward", _count: { _all: 1 }, _sum: { amount: 25 } }
      ]
    }
  };
  const stats = await getCurrencyStats(prisma, "guild-1", "user-1");
  assert.equal(stats.vaultWins, 2);
  assert.equal(stats.vaultLosses, 3);
  assert.equal(stats.gameWins, 2);
  assert.equal(stats.gameLosses, 3);
  assert.equal(stats.gamesPlayed, 5);
  assert.equal(stats.lifetimeEarned, 25);
});
