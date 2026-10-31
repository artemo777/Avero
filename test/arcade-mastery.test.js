import test from "node:test";
import assert from "node:assert/strict";
import { getArcadeMastery } from "../src/bot/arcade-mastery.js";

test("arcade mastery advances through four cosmetic tiers per game", () => {
  const mastery = getArcadeMastery({
    guessWins: 0,
    rpsWins: 5,
    coinflipWins: 18,
    vaultWins: 30
  });
  assert.deepEqual(mastery.map((game) => [game.id, game.tier]), [
    ["guess", "Rookie"],
    ["rps", "Contender"],
    ["coinflip", "Specialist"],
    ["vault", "Champion"]
  ]);
  assert.deepEqual(mastery[0].progress, { current: 0, required: 5 });
  assert.deepEqual(mastery[1].progress, { current: 0, required: 10 });
  assert.deepEqual(mastery[2].progress, { current: 3, required: 15 });
  assert.equal(mastery[3].progress, null);
  assert.equal(mastery[3].nextTier, null);
});

test("arcade mastery safely handles missing or invalid counters", () => {
  const mastery = getArcadeMastery({ guessWins: -1, rpsWins: 1.5 });
  assert.equal(mastery[0].wins, 0);
  assert.equal(mastery[1].wins, 0);
  assert.equal(mastery[2].wins, 0);
  assert.equal(mastery[3].wins, 0);
});
