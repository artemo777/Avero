import test from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_REWARD, DAILY_COOLDOWN_MS,
  WORK_REWARD_MIN, WORK_REWARD_MAX, WORK_COOLDOWN_MS,
  SCAVENGE_REWARD_MIN, SCAVENGE_REWARD_MAX, SCAVENGE_COOLDOWN_MS,
  GUESS_REWARD, GUESS_REWARD_COOLDOWN_MS
} from "../src/bot/economy-rules.js";

test("economy reward rules stay explicit and internally consistent", () => {
  assert.equal(DAILY_REWARD, 100);
  assert.equal(DAILY_COOLDOWN_MS, 24 * 60 * 60 * 1000);
  assert.deepEqual([WORK_REWARD_MIN, WORK_REWARD_MAX], [60, 120]);
  assert.equal(WORK_COOLDOWN_MS, 30 * 60 * 1000);
  assert.deepEqual([SCAVENGE_REWARD_MIN, SCAVENGE_REWARD_MAX], [25, 55]);
  assert.equal(SCAVENGE_COOLDOWN_MS, 10 * 60 * 1000);
  assert.equal(GUESS_REWARD, 25);
  assert.equal(GUESS_REWARD_COOLDOWN_MS, 10 * 60 * 1000);
});
