import test from "node:test";
import assert from "node:assert/strict";
import { renderBalance, renderBuy } from "../src/bot/game-ui.js";
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
  assert.match(text, /\/daily.*100 every 24h/);
  assert.match(text, /\/work.*60–120 every 30m/);
  assert.match(text, /\/scavenge.*25–55 every 10m.*collectible chance/);
  assert.match(text, /contracts.*4 daily goals.*345\/day/);
  assert.match(text, /\/coinflip.*shared 10m cooldown/);
  assert.match(text, /\/guess.*one reward every 10m/);
  assert.match(text, /\/rps.*\+25 on a win.*shared 10m cooldown/);
  assert.match(text, /\/vault.*daily puzzle.*one attempt and \+25 reward per UTC day/i);
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
