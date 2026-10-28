import test from "node:test";
import assert from "node:assert/strict";
import { ASSETS, getAsset, getAssetSymbol, getCollectibleAssetId, getRarityAssetId, listAssets, loadAssetBuffer, loadRegisteredAsset } from "../averoui/index.js";

test("shared asset catalogue supports lookup and kind filtering", () => {
  assert.equal(getAsset("brand-mark").value, "◈");
  assert.equal(getAsset("missing-asset"), null);
  assert.ok(listAssets({ kind: "glyph" }).length >= 1);
  assert.ok(listAssets({ kind: "svg" }).length >= 8);
  assert.equal(getAsset("coin").path, "icons/coin.svg");
  assert.equal(getAssetSymbol("coin"), "◉");
  assert.equal(getAssetSymbol("missing"), "·");
  assert.equal(getRarityAssetId("EPIC"), "gem-epic");
  assert.equal(getRarityAssetId("MYTHIC"), "gem-legendary");
  assert.equal(getCollectibleAssetId("neon_badge"), "collectible-neon-badge");
  assert.equal(getCollectibleAssetId("avero_relic"), "collectible-avero-relic");
  assert.equal(getCollectibleAssetId("unknown"), "badge");
  assert.ok(listAssets().some((asset) => asset.id === "games-hero"));
  assert.ok(Object.isFrozen(ASSETS));
});

test("registered SVG files are loadable and contain SVG markup", async () => {
  const coin = await loadRegisteredAsset("coin");
  assert.match(coin.toString("utf8"), /<svg[ >]/);
  assert.ok(coin.length > 100);
  await assert.rejects(loadRegisteredAsset("missing"), /does not refer to a registered local file/);
});

test("asset loader rejects absolute and traversal paths", async () => {
  await assert.rejects(loadAssetBuffer("../package.json"), /inside the assets/);
  await assert.rejects(loadAssetBuffer("/etc/passwd"), /relative path/);
  await assert.rejects(loadAssetBuffer(""), /relative path/);
});

test("each shop collectible has its own registered SVG artwork", async () => {
  const ids = ["neon_badge", "vault_badge", "starlight_badge", "moonlit_token", "prism_crown", "avero_relic"];
  const artworkIds = ids.map(getCollectibleAssetId);
  assert.equal(new Set(artworkIds).size, ids.length);
  for (const id of artworkIds) {
    const artwork = await loadRegisteredAsset(id);
    assert.match(artwork.toString("utf8"), /<svg[ >]/);
    assert.ok(artwork.length > 200);
  }
});
