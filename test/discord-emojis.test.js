import test from "node:test";
import assert from "node:assert/strict";
import { DISCORD_EMOJI, getCollectibleEmoji } from "../averoui/discord-emojis.js";

test("Avero Discord emoji pack exposes consistent game and currency symbols", () => {
  for (const key of ["brand", "games", "guess", "rock", "paper", "scissors", "shop", "inventory", "wallet", "work", "scavenge", "daily", "buy", "owned", "reward", "milestone"]) {
    assert.equal(typeof DISCORD_EMOJI[key], "string", key + " should be defined");
    assert.ok(DISCORD_EMOJI[key].length > 0, key + " should not be empty");
  }
});

test("every shop collectible has a dedicated emoji with a safe fallback", () => {
  const ids = ["neon_badge", "vault_badge", "starlight_badge", "moonlit_token", "prism_crown", "avero_relic"];
  const emojis = ids.map(getCollectibleEmoji);
  assert.equal(new Set(emojis).size, ids.length);
  assert.ok(emojis.every((emoji) => typeof emoji === "string" && emoji.length > 0));
  assert.equal(getCollectibleEmoji("unknown_item"), DISCORD_EMOJI.collectible);
});

test("emoji catalogue is immutable to avoid accidental UI drift", () => {
  assert.ok(Object.isFrozen(DISCORD_EMOJI));
  assert.ok(Object.isFrozen(DISCORD_EMOJI.collectibles));
});
