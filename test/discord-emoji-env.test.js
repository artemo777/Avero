import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mergeEnvAssignments, writeEmojiEnvironment } from "../scripts/discord-emoji-env.js";

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


test("emoji env persistence keeps existing secrets and restricts file permissions", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avero-emoji-env-"));
  const envPath = path.join(directory, ".env");
  try {
    await writeFile(envPath, "DISCORD_TOKEN=placeholder-secret\nDATABASE_URL=postgres://example\nAVERO_EMOJI_COIN_ID=old-id\n", { mode: 0o644 });
    await writeEmojiEnvironment({ AVERO_EMOJI_COIN_ID: "123456789012345678" }, envPath);
    const content = await readFile(envPath, "utf8");
    const metadata = await stat(envPath);
    assert.match(content, /DISCORD_TOKEN=placeholder-secret/);
    assert.match(content, /DATABASE_URL=postgres:\/\/example/);
    assert.match(content, /AVERO_EMOJI_COIN_ID=123456789012345678/);
    assert.equal((metadata.mode & 0o777), 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
