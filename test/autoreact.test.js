import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAutoReactionEmoji } from "../src/bot/commands/autoreact.js";

test("accepts a single Unicode emoji", () => {
  assert.deepEqual(normalizeAutoReactionEmoji("🔥"), { kind: "unicode", value: "🔥" });
});

test("accepts flags and keycap emoji", () => {
  assert.equal(normalizeAutoReactionEmoji("🇩🇰").kind, "unicode");
  assert.equal(normalizeAutoReactionEmoji("1️⃣").kind, "unicode");
});

test("accepts a server custom emoji format", () => {
  assert.deepEqual(normalizeAutoReactionEmoji("<:avero:12345678901234567>"), {
    kind: "custom", id: "12345678901234567", value: "<:avero:12345678901234567>"
  });
});

test("rejects text and multiple emoji", () => {
  assert.throws(() => normalizeAutoReactionEmoji("hello"), /standard emoji/);
  assert.throws(() => normalizeAutoReactionEmoji("🔥😂"), /exactly one emoji/);
  assert.throws(() => normalizeAutoReactionEmoji("🔥 hello"), /one emoji/);
});

test("rejects malformed custom emoji", () => {
  assert.throws(() => normalizeAutoReactionEmoji("<:outside:123>"), /standard emoji/);
});
