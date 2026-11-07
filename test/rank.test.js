import test from "node:test";
import assert from "node:assert/strict";
import { formatRankStats } from "../src/bot/commands/rank.js";

test("rank stats keep level, XP, messages and voice minutes separate", () => {
  const stats = formatRankStats({
    level: 99,
    xp: "20662",
    levelXp: "45627",
    messages: 4382,
    voiceSeconds: 328 * 60
  });
  assert.equal(stats.level, 99);
  assert.equal(stats.xp, 20662);
  assert.equal(stats.messages, 4382);
  assert.equal(stats.voiceMinutes, 328);
  assert.equal(stats.progressPercent, 45);
  assert.equal(stats.progressBar.length, 12);
});

test("rank stats safely handle missing or malformed API values", () => {
  const stats = formatRankStats({ level: "not-a-number", xp: null, levelXp: 0, messages: -2, voiceSeconds: "bad" });
  assert.equal(stats.level, 0);
  assert.equal(stats.xp, 0);
  assert.equal(stats.messages, 0);
  assert.equal(stats.voiceMinutes, 0);
  assert.equal(stats.progressPercent, 0);
});
