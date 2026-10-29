import test from "node:test";
import assert from "node:assert/strict";
import { mergeEnvAssignments } from "../scripts/discord-emoji-env.js";

test("emoji env sync replaces existing IDs without changing unrelated settings", () => {
  const source = [
    "# keep this comment",
    "DISCORD_TOKEN=secret-value",
    "AVERO_EMOJI_COIN_ID=old-id",
    "DATABASE_URL=postgres://example",
    ""
  ].join("\n");
  const merged = mergeEnvAssignments(source, {
    AVERO_EMOJI_COIN_ID: "123456789012345678",
    AVERO_EMOJI_BRAND_ID: "234567890123456789"
  });

  assert.match(merged, /# keep this comment/);
  assert.match(merged, /DISCORD_TOKEN=secret-value/);
  assert.match(merged, /DATABASE_URL=postgres:\/\/example/);
  assert.match(merged, /AVERO_EMOJI_COIN_ID=123456789012345678/);
  assert.match(merged, /AVERO_EMOJI_BRAND_ID=234567890123456789/);
  assert.equal((merged.match(/AVERO_EMOJI_COIN_ID=/g) ?? []).length, 1);
});

test("emoji env sync handles an empty file and does not duplicate keys", () => {
  assert.equal(
    mergeEnvAssignments("", { AVERO_EMOJI_COIN_ID: "123456789012345678" }),
    "AVERO_EMOJI_COIN_ID=123456789012345678\n"
  );
  const merged = mergeEnvAssignments("AVERO_EMOJI_COIN_ID=old\nAVERO_EMOJI_COIN_ID=older", {
    AVERO_EMOJI_COIN_ID: "123456789012345678"
  });
  assert.equal((merged.match(/AVERO_EMOJI_COIN_ID=/g) ?? []).length, 1);
  assert.match(merged, /AVERO_EMOJI_COIN_ID=123456789012345678/);
});
