import test from "node:test";
import assert from "node:assert/strict";
import { getServerEmoji, listServerEmojis, setServerEmojis } from "../averoui/server-emojis.js";

test("server emoji registry resolves semantic purposes and preserves animated markup", () => {
  setServerEmojis([
    { id: "12345678901234567", name: "avero_coin", animated: false, available: true },
    { id: "12345678901234568", name: "rare_gem", animated: true, available: true },
    { id: "12345678901234569", name: "badge", animated: false, available: true }
  ]);
  assert.equal(getServerEmoji("coin"), "<:avero_coin:12345678901234567>");
  assert.equal(getServerEmoji("gem-rare"), "<a:rare_gem:12345678901234568>");
  assert.equal(getServerEmoji("badge"), "<:badge:12345678901234569>");
  assert.equal(getServerEmoji("success", "✔️"), "✔️");
  assert.equal(listServerEmojis().length, 3);
});

test("refreshing the registry removes emojis that are no longer available", () => {
  setServerEmojis([{ id: "12345678901234567", name: "coin", available: true }]);
  assert.equal(getServerEmoji("coin"), "<:coin:12345678901234567>");
  setServerEmojis([]);
  assert.equal(getServerEmoji("coin", "◉"), "◉");
  assert.deepEqual(listServerEmojis(), []);
});
