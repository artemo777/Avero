import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { achievementsCommand, renderAchievementsPage } from "../src/bot/commands/achievements.js";
function panelText(response) { return response.components[0].toJSON().components.filter((item) => item.type === 10).map((item) => item.content).join("\n"); }
function panelRows(response) { return response.components[0].toJSON().components.filter((item) => item.type === 1); }

test("achievements show global milestone progress and unique collection counts", async () => {
  let response;
  const rows = [
    { type: "work", _count: { _all: 1 }, _sum: { amount: 80 } },
    { type: "scavenge", _count: { _all: 1 }, _sum: { amount: 25 } },
    { type: "rps_win", _count: { _all: 5 }, _sum: { amount: 0 } },
    { type: "guess_loss", _count: { _all: 5 }, _sum: { amount: 0 } },
    { type: "shop_purchase", _count: { _all: 3 }, _sum: { amount: -1200 } },
    { type: "daily", _count: { _all: 1 }, _sum: { amount: 100 } }
  ];
  const prisma = {
    currencyTransaction: { groupBy: async ({ where }) => {
      assert.deepEqual(where, { guildId: "__avero_global__", userId: "user-1" });
      return rows;
    } },
    currencyPurchase: { findMany: async () => [
      { itemId: "neon_badge" },
      { itemId: "vault_badge" },
      { itemId: "starlight_badge" }
    ] }
  };

  await achievementsCommand.execute({
    guildId: "guild-1",
    user: { id: "user-1", username: "Ada" },
    options: { getUser: () => null },
    reply: async (payload) => { response = payload; }
  }, { prisma });

  const text = panelText(response);
  assert.match(text, /Ada's achievements/);
  assert.match(text, /7 \/ 12 unlocked/);
  assert.match(text, /Curator[\s\S]*Unlocked/);
  assert.match(text, /Full Set[\s\S]*3 \/ 41/);
  assert.deepEqual(response.allowedMentions, { parse: [] });
  const secondPage = await renderAchievementsPage(prisma, "guild-1", { id: "user-1", username: "Ada" }, "user-1", 1);
  const secondText = panelText(secondPage);
  assert.match(secondText, /Big Spender[\s\S]*Unlocked/);
  assert.match(secondText, /Archive Keeper[\s\S]*0 \/ 1/);
  assert.equal(panelRows(secondPage).length, 1);

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
