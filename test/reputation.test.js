import test from "node:test";
import assert from "node:assert/strict";
import { calculateReputation, REPUTATION_COOLDOWN_MS } from "../src/db/reputation-repository.js";

test("reputation net score keeps positive and negative totals separate", () => {
  assert.deepEqual(calculateReputation(146, 18), { positive: 146, negative: 18, net: 128 });
});

test("reputation score safely normalizes missing and invalid values", () => {
  assert.deepEqual(calculateReputation(undefined, -4), { positive: 0, negative: 0, net: 0 });
  assert.deepEqual(calculateReputation("5", "2"), { positive: 5, negative: 2, net: 3 });
});

test("reputation cooldown is 24 hours", () => {
  assert.equal(REPUTATION_COOLDOWN_MS, 24 * 60 * 60 * 1000);
});
