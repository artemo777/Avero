import test from "node:test";
import assert from "node:assert/strict";
import { getEligibleMilestoneTitles, TITLE_CATALOG } from "../src/bot/title-catalog.js";
import { titlesCommand } from "../src/bot/commands/titles.js";
import { MessageFlags } from "discord.js";

test("milestone titles unlock at their configured game and economy thresholds", () => {
  const eligible = getEligibleMilestoneTitles({
    gamesPlayed: 50,
    gameWins: 10,
    lifetimeEarned: 10000,
    workShifts: 25,
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
    "thirty_day_streak",
    "career_pro",
    "coin_architect",
    "arcade_regular"
  ]) {
    assert.ok(ids.has(id), id + " should be unlocked");
  }
  assert.equal(eligible.length, 11);
});

test("shop titles are separate from milestone titles", () => {
  const shopTitles = TITLE_CATALOG.filter((title) => Number.isSafeInteger(title.price));
  assert.ok(shopTitles.length >= 1);
  assert.ok(shopTitles.every((title) => !title.unlock && title.price > 0));
});

test("title purchases are blocked while server currency is paused", async () => {
  let response;
  const interaction = {
    guildId: "guild-1",
    user: { id: "user-1" },
    options: {
      getString(name) {
        return name === "action" ? "buy" : name === "title" ? "fresh_spawn" : null;
      }
    },
    reply: async (payload) => { response = payload; }
  };
  const prisma = new Proxy({}, {
    get() {
      throw new Error("A paused title purchase must not access the database.");
    }
  });

  await titlesCommand.execute(interaction, { prisma, settings: { currencyEnabled: false } });

  assert.deepEqual(response, {
    content: "Currency is paused by this server's admins. Title purchases are unavailable right now.",
    flags: MessageFlags.Ephemeral
  });
});


test("each individual collection set unlocks its matching profile title", () => {
  const cases = [
    ["archive-protocol", "archive_keeper"],
    ["neon-circuit", "circuit_breaker"],
    ["moonlit-relics", "moonlit_curator"]
  ];
  for (const [setId, titleId] of cases) {
    const stat = "collectionSet:" + setId;
    const locked = getEligibleMilestoneTitles({ [stat]: 0 }, 0);
    const unlocked = getEligibleMilestoneTitles({ [stat]: 1 }, 0);
    assert.ok(!locked.some((title) => title.id === titleId), titleId + " should remain locked before set completion");
    assert.ok(unlocked.some((title) => title.id === titleId), titleId + " should unlock when its set is complete");
  }
});

test("all collection-set display titles exist in the equipable title catalog", async () => {
  const { COLLECTION_SETS } = await import("../src/bot/collection-sets.js");
  for (const set of COLLECTION_SETS) {
    assert.ok(TITLE_CATALOG.some((title) => title.name === set.title), set.title + " must be equipable");
  }
});
