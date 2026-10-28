import test from "node:test";
import assert from "node:assert/strict";
import { ASSETS, getAsset, listAssets, loadAssetBuffer, loadRegisteredAsset } from "../averoui/index.js";

test("shared asset catalogue supports lookup and kind filtering", () => {
  assert.equal(getAsset("brand-mark").value, "◈");
  assert.equal(getAsset("missing-asset"), null);
  assert.ok(listAssets({ kind: "glyph" }).length >= 1);
  assert.ok(listAssets({ kind: "svg" }).length >= 8);
  assert.equal(getAsset("coin").path, "icons/coin.svg");
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
