import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFishingAttempt } from "../src/bot/fishing-core.js";

test("fishing miss awards no score or coins", () => {
  assert.deepEqual(evaluateFishingAttempt({ reactionMs: 901, targetMs: 900 }), {
    caught: false, score: 0, coins: 0, tier: "miss"
  });
});

test("fishing attempt is deterministic and bounded", () => {
  const result = evaluateFishingAttempt({ reactionMs: 300, targetMs: 900 });
  assert.deepEqual(result, evaluateFishingAttempt({ reactionMs: 300, targetMs: 900 }));
  assert.equal(result.caught, true);
  assert.ok(result.score >= 1 && result.score <= 100);
  assert.ok(result.coins >= 5 && result.coins <= 25);
});

test("reaction at the target threshold is a valid catch", () => {
  assert.equal(evaluateFishingAttempt({ reactionMs: 900, targetMs: 900 }).caught, true);
});

test("invalid input is rejected", () => {
  for (const input of [
    { reactionMs: -1, targetMs: 500 },
    { reactionMs: 2001, targetMs: 500 },
    { reactionMs: 1.5, targetMs: 500 },
    { reactionMs: 500, targetMs: 299 },
    { reactionMs: 500, targetMs: 901 }
  ]) assert.throws(() => evaluateFishingAttempt(input), RangeError);
});
