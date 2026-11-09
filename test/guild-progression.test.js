import test from "node:test";
import assert from "node:assert/strict";
import { normalizeImportedMember } from "../src/db/guild-progression-repository.js";

test("Engauge migration preserves cumulative XP and level when progress threshold is absent", () => {
  const row = normalizeImportedMember({
    id: "12345678901234567", xp: "20662", level: "99",
    messages: "4382", voiceSeconds: "19680", currency: "250"
  });
  assert.equal(row.totalXp, 20662);
  assert.equal(row.level, 99);
  assert.equal(row.xp, 0);
  assert.equal(row.messages, 4382);
  assert.equal(row.voiceSeconds, 19680);
  assert.equal(row.currency, 250);
});

test("Engauge migration preserves explicit current-level XP progress", () => {
  const row = normalizeImportedMember({
    xp: "1200", totalXp: "11200", level: "4", levelXp: "2000"
  });
  assert.equal(row.xp, 1200);
  assert.equal(row.totalXp, 11200);
  assert.equal(row.level, 4);
  assert.equal(row.nextLevelXp, 2000);
});
