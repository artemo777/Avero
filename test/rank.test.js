import test from "node:test";
import { MessageFlags } from "discord.js";
import assert from "node:assert/strict";
import { buildRankPayload, formatRankStats } from "../src/bot/commands/rank.js";

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


test("rank payload uses the compact canvas card and Professor component thumbnail", async () => {
  const payload = await buildRankPayload({
    id: "12345678901234567", username: "Avero Tester", displayAvatarURL: () => null
  }, { level: 12, xp: 5400, levelXp: 8000, messages: 240, voiceSeconds: 3600 });
  assert.equal(payload.flags, MessageFlags.IsComponentsV2);
  assert.deepEqual(payload.files.map((file) => file.name).sort(), ["avero-professor.png", "rank-card.png"]);
  assert.ok(payload.components[0].toJSON().components.some((component) => component.type === 9));
  const card = payload.files.find((file) => file.name === "rank-card.png");
  assert.equal(card.attachment.toString("hex", 0, 8), "89504e470d0a1a0a");
});
