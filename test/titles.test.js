import test from "node:test";
import assert from "node:assert/strict";
import { getEligibleMilestoneTitles, TITLE_CATALOG } from "../src/bot/title-catalog.js";

test("milestone titles unlock at their configured game and economy thresholds", () => {
  const eligible = getEligibleMilestoneTitles({
    gamesPlayed: 25,
    gameWins: 10,
    lifetimeEarned: 5000,
    workShifts: 10,
    scavenges: 10,
    dailyStreak: 30
  }, 3);
  const ids = new Set(eligible.map((title) => title.id));

  for (const id of [
    "lobby_menace",
    "certified_clutch",
    "coin_goblin",
    "shift_gremlin",
    "bin_diver_deluxe",
    "shelf_lord",
    "seven_day_streak",
    "thirty_day_streak"
  ]) {
    assert.ok(ids.has(id), id + " should be unlocked");
  }
  assert.equal(eligible.length, 8);
});

test("shop titles are separate from milestone titles", () => {
  const shopTitles = TITLE_CATALOG.filter((title) => Number.isSafeInteger(title.price));
  assert.ok(shopTitles.length >= 1);
  assert.ok(shopTitles.every((title) => !title.unlock && title.price > 0));
});
