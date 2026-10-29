import test from "node:test";
import assert from "node:assert/strict";
import { DISCORD_EMOJI, getCollectibleEmoji, getDiscordEmoji } from "../averoui/discord-emojis.js";
import { getAssetSymbol } from "../averoui/assets.js";

test("Avero Discord emoji pack exposes consistent game and currency symbols", () => {
  for (const key of ["brand", "games", "guess", "rock", "paper", "scissors", "shop", "inventory", "wallet", "work", "scavenge", "daily", "buy", "owned", "reward", "milestone", "loader", "gemCommon", "gemRare", "gemEpic", "gemLegendary"]) {
    assert.equal(typeof DISCORD_EMOJI[key], "string", key + " should be defined");
    assert.ok(DISCORD_EMOJI[key].length > 0, key + " should not be empty");
  }
});

test("registered rarity and brand assets resolve through the shared emoji catalogue", () => {
  for (const id of ["coin", "gem-common", "gem-rare", "gem-epic", "gem-legendary", "badge", "reward-sparkle", "loader", "brand-mark-svg"]) {
    assert.equal(typeof getAssetSymbol(id), "string", id + " should resolve to a display symbol");
    assert.ok(getAssetSymbol(id).length > 0, id + " should not resolve to an empty symbol");
  }
});

test("every shop collectible has a dedicated emoji with a safe fallback", () => {
  const ids = ["neon_badge", "vault_badge", "starlight_badge", "moonlit_token", "prism_crown", "avero_relic"];
  const emojis = ids.map(getCollectibleEmoji);
  assert.equal(new Set(emojis).size, ids.length);
  assert.ok(emojis.every((emoji) => typeof emoji === "string" && emoji.length > 0));
  assert.equal(getCollectibleEmoji("unknown_item"), DISCORD_EMOJI.collectible);
});

test("custom emojis are only resolved for their configured source guild", () => {
  const previousGuild = process.env.DISCORD_GUILD_ID;
  const previousCoin = process.env.AVERO_EMOJI_COIN_ID;
  const previousNeon = process.env.AVERO_EMOJI_NEON_BADGE_ID;
  try {
    process.env.DISCORD_GUILD_ID = "12345678901234567";
    process.env.AVERO_EMOJI_COIN_ID = "23456789012345678";
    process.env.AVERO_EMOJI_NEON_BADGE_ID = "34567890123456789";
    assert.equal(getDiscordEmoji("wallet", "12345678901234567"), "<:avero_coin:23456789012345678>");
    assert.equal(getAssetSymbol("coin", "12345678901234567"), "<:avero_coin:23456789012345678>");
    assert.equal(getCollectibleEmoji("neon_badge", "12345678901234567"), "<:avero_neon_badge:34567890123456789>");
    assert.equal(getDiscordEmoji("wallet", "34567890123456789"), "◉");
    assert.equal(getAssetSymbol("coin", "34567890123456789"), "◉");
    assert.equal(getCollectibleEmoji("neon_badge", "34567890123456789"), "🌟");
    assert.equal(getDiscordEmoji("wallet"), "◉");
    assert.equal(getDiscordEmoji("wallet", "12345678901234567"), "<:avero_coin:23456789012345678>");
  } finally {
    if (previousGuild === undefined) delete process.env.DISCORD_GUILD_ID;
    else process.env.DISCORD_GUILD_ID = previousGuild;
    if (previousCoin === undefined) delete process.env.AVERO_EMOJI_COIN_ID;
    else process.env.AVERO_EMOJI_COIN_ID = previousCoin;
    if (previousNeon === undefined) delete process.env.AVERO_EMOJI_NEON_BADGE_ID;
    else process.env.AVERO_EMOJI_NEON_BADGE_ID = previousNeon;
  }
});

test("coin fallback preserves the established asset symbol", () => {
  assert.equal(getAssetSymbol("coin"), "◉");
  assert.equal(DISCORD_EMOJI.wallet, "◉");
});

test("emoji catalogue is immutable to avoid accidental UI drift", () => {
  assert.ok(Object.isFrozen(DISCORD_EMOJI));
  assert.ok(Object.isFrozen(DISCORD_EMOJI.collectibles));
});
