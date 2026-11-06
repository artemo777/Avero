import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReactionEmoji, resolveSharedCustomEmoji } from "../src/bot/auto-reactions.js";

test("normalizes Discord-style emoji shortcodes to Unicode", () => {
  assert.deepEqual(normalizeReactionEmoji(":rainbow_flag:"), {
    kind: "unicode",
    value: "🏳️‍🌈"
  });
  assert.equal(normalizeReactionEmoji(":heart:").value, "❤️");
});

test("rejects unknown shortcode aliases with a useful validation error", () => {
  assert.throws(
    () => normalizeReactionEmoji(":not_a_real_emoji:"),
    /shortcode is not recognized/i
  );
});

test("continues to accept Unicode and custom Discord emoji markup", () => {
  assert.equal(normalizeReactionEmoji("🔥").value, "🔥");
  assert.deepEqual(normalizeReactionEmoji("<a:party_blob:123456789012345678>"), {
    kind: "custom",
    id: "123456789012345678",
    value: "<a:party_blob:123456789012345678>"
  });
});

test("finds an available custom emoji in any cached mutual guild", () => {
  const emoji = { id: "123456789012345678", available: true };
  const client = {
    guilds: {
      cache: new Map([
        ["first", { emojis: { cache: new Map() } }],
        ["second", { emojis: { cache: new Map([[emoji.id, emoji]]) } }]
      ])
    }
  };
  assert.equal(resolveSharedCustomEmoji(client, emoji.id), emoji);
});

test("does not resolve missing or unavailable custom emojis", () => {
  const unavailable = { id: "123456789012345678", available: false };
  const client = {
    guilds: { cache: new Map([["one", { emojis: { cache: new Map([[unavailable.id, unavailable]]) } }]]) }
  };
  assert.equal(resolveSharedCustomEmoji(client, unavailable.id), null);
  assert.equal(resolveSharedCustomEmoji(client, "999999999999999999"), null);
});
