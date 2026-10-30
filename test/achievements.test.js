import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { achievementsCommand } from "../src/bot/commands/achievements.js";

test("achievements show server-scoped milestone progress and unique collection counts", async () => {
  let response;
  const rows = [
    { type: "work", _count: { _all: 1 }, _sum: { amount: 80 } },
    { type: "scavenge", _count: { _all: 1 }, _sum: { amount: 25 } },
    { type: "rps_win", _count: { _all: 5 }, _sum: { amount: 0 } },
    { type: "guess_loss", _count: { _all: 5 }, _sum: { amount: 0 } },
    { type: "shop_purchase", _count: { _all: 3 }, _sum: { amount: -600 } },
    { type: "daily", _count: { _all: 1 }, _sum: { amount: 100 } }
  ];
  const prisma = {
    currencyTransaction: { groupBy: async ({ where }) => {
      assert.deepEqual(where, { guildId: "guild-1", userId: "user-1" });
      return rows;
    } },
    currencyPurchase: { findMany: async () => [
      { itemId: "neon_badge" },
      { itemId: "vault_badge" },
      { itemId: "neon_badge" }
    ] }
  };

  await achievementsCommand.execute({
    guildId: "guild-1",
    user: { id: "user-1", username: "Ada" },
    options: { getUser: () => null },
    reply: async (payload) => { response = payload; }
  }, { prisma });

  const embed = response.embeds[0];
  assert.match(embed.title, /Ada's achievements/);
  assert.match(embed.description, /6 \/ 9 unlocked/);
  assert.equal(embed.fields.length, 9);
  assert.match(embed.fields.find((field) => field.name.includes("Curator")).value, /Unlocked/);
  assert.match(embed.fields.find((field) => field.name.includes("Full Set")).value, /2 \/ 6/);
  assert.match(embed.fields.find((field) => field.name.includes("Big Spender")).value, /Unlocked/);
  assert.deepEqual(response.allowedMentions, { parse: [] });
});

test("achievements reject direct messages privately", async () => {
  let response;
  await achievementsCommand.execute({
    guildId: null,
    reply: async (payload) => { response = payload; }
  }, { prisma: {} });

  assert.deepEqual(response, {
    content: "Achievements are available inside a server.",
    flags: MessageFlags.Ephemeral
  });
});
