import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { coinflipCommand } from "../src/bot/commands/coinflip.js";
import { getCurrencyStats } from "../src/db/currency-repository.js";

function makeInteraction({ guildId = "guild-1", call = "heads" } = {}) {
  let response;
  return {
    interaction: {
      guildId,
      user: { id: "user-1" },
      options: { getString: (name) => {
        assert.equal(name, "call");
        return call;
      } },
      reply: async (payload) => { response = payload; }
    },
    getResponse: () => response
  };
}

test("coinflip is a free game that records its result and only rewards wins", async () => {
  const { interaction, getResponse } = makeInteraction();
  const records = [];
  const account = { balance: 0, lastGameRewardAt: null };
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyTransaction: { create: async ({ data }) => { records.push(data); return data; } },
    currencyAccount: {
      upsert: async () => account,
      updateMany: async ({ where, data }) => {
        if (where.OR && account.lastGameRewardAt !== null) return { count: 0 };
        account.balance += data.balance.increment;
        account.lastGameRewardAt = data.lastGameRewardAt;
        return { count: 1 };
      },
      findUnique: async () => ({ ...account })
    }
  };

  await coinflipCommand.execute(interaction, { prisma });
  const response = getResponse();
  const text = response.components[0].toJSON().components
    .filter((component) => component.type === 10)
    .map((component) => component.content)
    .join("\n");
  const won = records.some((record) => record.type === "coinflip_win");

  assert.match(text, /You called/);
  assert.match(text, /Avero flipped/);
  assert.match(text, /FREE PLAY.*NO WAGERS/);
  assert.equal(records[0].amount, 0);
  assert.match(records[0].type, /^coinflip_(win|loss)$/);
  assert.equal(records.filter((record) => record.type === "coinflip_reward").length, won ? 1 : 0);
  if (won) assert.match(text, /\+25 coins|cooldown is active/);
  else assert.match(text, /no coins were lost/i);
});

test("coinflip rejects invalid calls without touching the database", async () => {
  const { interaction, getResponse } = makeInteraction({ call: "edge" });
  await coinflipCommand.execute(interaction);
  assert.deepEqual(getResponse(), {
    content: "Choose heads or tails.",
    flags: MessageFlags.Ephemeral
  });
});

test("coinflip rejects direct messages", async () => {
  const { interaction, getResponse } = makeInteraction({ guildId: null });
  await coinflipCommand.execute(interaction);
  assert.deepEqual(getResponse(), {
    content: "Coinflip is available inside a server.",
    flags: MessageFlags.Ephemeral
  });
});

test("coinflip results count toward server game stats and achievements", async () => {
  const rows = [
    { type: "coinflip_win", _count: { _all: 2 }, _sum: { amount: 0 } },
    { type: "coinflip_loss", _count: { _all: 1 }, _sum: { amount: 0 } }
  ];
  const stats = await getCurrencyStats({
    currencyTransaction: { groupBy: async () => rows }
  }, "guild-1", "user-1");

  assert.equal(stats.gameWins, 2);
  assert.equal(stats.gameLosses, 1);
  assert.equal(stats.gamesPlayed, 3);
});
