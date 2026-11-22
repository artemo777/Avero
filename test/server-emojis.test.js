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
  assert.equal(getServerEmoji("coin", "🪙"), "<:avero_coin:12345678901234567>");
  assert.equal(listServerEmojis().length, 3);
});

test("matches complete semantic tokens without confusing similar names", () => {
  setServerEmojis([
    { id: "12345678901234570", name: "uncommon_gem", available: true },
    { id: "12345678901234575", name: "common_gem", available: true },
    { id: "12345678901234571", name: "coinflip", available: true },
    { id: "12345678901234572", name: "shop_cart", available: true },
    { id: "12345678901234573", name: "avero_daily_gift", available: true }
  ]);
  assert.equal(getServerEmoji("gem-common", "fallback"), "<:common_gem:12345678901234575>");
  assert.equal(getServerEmoji("coin", "fallback"), "fallback");
  assert.equal(getServerEmoji("shop", "fallback"), "<:shop_cart:12345678901234572>");
  assert.equal(getServerEmoji("daily", "fallback"), "<:avero_daily_gift:12345678901234573>");
});

test("refreshing the registry removes emojis that are no longer available", () => {
  setServerEmojis([{ id: "12345678901234567", name: "coin", available: true }]);
  assert.equal(getServerEmoji("coin"), "<:coin:12345678901234567>");
  setServerEmojis([]);
  assert.equal(getServerEmoji("coin", "◉"), "◉");
  assert.deepEqual(listServerEmojis(), []);
});


test("shop item emoji purposes recognize common server emoji names", () => {
  setServerEmojis([
    { id: "12345678901234580", name: "avero_pin", available: true },
    { id: "12345678901234581", name: "archive_key", available: true },
    { id: "12345678901234582", name: "founders_medal", available: true }
  ]);
  assert.equal(getServerEmoji("neon_badge", "fallback"), "<:avero_pin:12345678901234580>");
  assert.equal(getServerEmoji("vault_badge", "fallback"), "<:archive_key:12345678901234581>");
  assert.equal(getServerEmoji("avero_relic", "fallback"), "<:founders_medal:12345678901234582>");
  setServerEmojis([]);
});
