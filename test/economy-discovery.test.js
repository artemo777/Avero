import test from "node:test";
import assert from "node:assert/strict";
import { renderBalance, renderBuy, renderDaily, renderWork, renderScavenge } from "../src/bot/game-ui.js";
import { helpCommand } from "../src/bot/commands/help.js";
import { SHOP_ITEMS } from "../src/bot/shop-catalog.js";

function panelText(response) {
  return response.components[0].toJSON().components
    .filter((component) => component.type === 10)
    .map((component) => component.content)
    .join("\n");
}

test("wallet explains every available coin earning route and cooldown", async () => {
  const response = await renderBalance({
    currencyAccount: { findUnique: async () => ({ balance: 420 }) }
  }, "guild-1", "user-1");

  const text = panelText(response);
  assert.match(text, /420 coins/);
  assert.ok(text.includes("/daily · every 24h"));
  assert.ok(text.includes("/work · every 30m"));
  assert.ok(text.includes("/scavenge · every 10m"));
  assert.ok(text.includes("/contracts · daily goals"));
  assert.ok(text.includes("/games · free mini-games"));
  assert.doesNotMatch(text, /canvas|attachment:\/\//i);
});

test("insufficient-funds purchase response points to all main earning commands", () => {
  const item = SHOP_ITEMS[0];
  const response = renderBuy({
    purchased: false,
    reason: "insufficient_funds",
    account: { balance: 20 }
  }, item, "user-1");

  assert.match(panelText(response), /daily, \/work, \/scavenge, \/contracts, \/guess, \/rps or \/vault/);
});

test("help documents game-specific leaderboards and free game rules", async () => {
  let response;
  await helpCommand.execute({ reply: async (payload) => { response = payload; } });
  const fields = response.embeds[0].fields;
  const games = fields.find((field) => field.name.includes("Games")).value;
  const profile = fields.find((field) => field.name.includes("Profile")).value;

  assert.match(games, /free, 10m reward cooldown/);
  assert.match(games, /free/);
  assert.match(profile, /games, coinflip, guess, RPS or Vault/);
});

test("daily responses stay compact and preserve streak, perk and cooldown details", () => {
  const claimed = panelText(renderDaily({
    claimed: true,
    dailyStreak: 4,
    account: { balance: 520, dailyStreak: 4 }
  }, "user-1", { reward: 100, perk: { dailyBonus: 20, flair: "Booster" } }));
  assert.match(claimed, /Daily claimed/);
  assert.match(claimed, /\+100 coins/);
  assert.match(claimed, /520 coins/);
  assert.match(claimed, /4 days/);
  assert.match(claimed, /\+20 coins/);
  assert.match(claimed, /See you tomorrow/);

  const cooldown = panelText(renderDaily({
    claimed: false,
    account: { lastDailyAt: new Date("2026-10-31T12:00:00Z"), dailyStreak: 4 }
  }, "user-1", { reward: 100 }));
  assert.match(cooldown, /Already claimed/);
  assert.match(cooldown, /Next drop/);
});

test("work responses keep reward and 30-minute cooldown clear", () => {
  const complete = panelText(renderWork({
    claimed: true,
    amount: 80,
    account: { balance: 500 }
  }, "user-1", "Sorted the community archive"));
  assert.match(complete, /Shift done/);
  assert.match(complete, /\+80 coins/);
  assert.match(complete, /500 coins/);
  assert.match(complete, /Back in 30 minutes/);

  const cooldown = panelText(renderWork({
    claimed: false,
    account: { lastWorkAt: new Date("2026-10-31T12:00:00Z") }
  }, "user-1", "Sorted the community archive"));
  assert.match(cooldown, /off the clock/i);
  assert.match(cooldown, /Next one opens/);
});

test("scavenge responses keep discoveries, duplicate bonuses and cooldowns clear", () => {
  const route = { id: "archive", name: "Old Server Archive", description: "Explore the archive." };
  const complete = panelText(renderScavenge({
    claimed: true,
    amount: 75,
    account: { balance: 575 }
  }, "user-1", route, null));
  assert.match(complete, /Run complete/);
  assert.match(complete, /\+75 coins/);
  assert.match(complete, /575 coins/);
  assert.match(complete, /Next run in 10 minutes/);

  const discovery = panelText(renderScavenge({
    claimed: true,
    amount: 75,
    itemId: "neon_badge",
    account: { balance: 575 }
  }, "user-1", route, { icon: "👾", name: "Neon Badge", rarity: "Common" }));
  assert.match(discovery, /New find/);
  assert.match(discovery, /Neon Badge/);
  assert.match(discovery, /Added to your collection/);

  const duplicate = panelText(renderScavenge({
    claimed: true,
    amount: 75,
    duplicateItemId: "neon_badge",
    bonus: 15,
    account: { balance: 590 }
  }, "user-1", route, { icon: "👾", name: "Neon Badge" }));
  assert.match(duplicate, /Duplicate find/);
  assert.match(duplicate, /\+15 coins/);

  const cooldown = panelText(renderScavenge({
    claimed: false,
    account: { lastScavengeAt: new Date("2026-10-31T12:00:00Z") }
  }, "user-1", route, null));
  assert.match(cooldown, /on cooldown/i);
  assert.match(cooldown, /next run opens/i);
});
