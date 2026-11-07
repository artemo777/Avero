import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReactionEmoji, resolveSharedCustomEmoji } from "../src/bot/auto-reactions.js";

test("normalizes common Discord emoji shortcodes", () => {
  assert.deepEqual(normalizeReactionEmoji(":rainbow_flag:"), { kind: "unicode", value: "🏳️‍🌈" });
  assert.equal(normalizeReactionEmoji(":heart:").value, "❤️");
  assert.equal(normalizeReactionEmoji(":fire:").value, "🔥");
});

test("unknown emoji shortcodes fail with a useful message", () => {
  assert.throws(() => normalizeReactionEmoji(":not_a_real_emoji:"), /shortcode is not recognized/i);
});

test("keeps accepting Unicode and custom Discord emoji markup", () => {
  assert.equal(normalizeReactionEmoji("🔥").value, "🔥");
  assert.deepEqual(normalizeReactionEmoji("<a:party_blob:123456789012345678>"), {
    kind: "custom", id: "123456789012345678", value: "<a:party_blob:123456789012345678>"
  });
});

test("resolves an available custom emoji from any cached mutual server", () => {
  const emoji = { id: "123456789012345678", available: true };
  const client = { guilds: { cache: new Map([
    ["first", { emojis: { cache: new Map() } }],
    ["second", { emojis: { cache: new Map([[emoji.id, emoji]]) } }]
  ]) } };
  assert.equal(resolveSharedCustomEmoji(client, emoji.id), emoji);
  assert.equal(resolveSharedCustomEmoji(client, "999999999999999999"), null);
});
