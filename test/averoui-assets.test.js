import test from "node:test";
import assert from "node:assert/strict";
import { ASSETS, getAsset, listAssets, loadAssetBuffer } from "../averoui/index.js";

test("shared asset catalogue supports lookup and kind filtering", () => {
  assert.equal(getAsset("brand-mark").value, "◈");
  assert.equal(getAsset("missing-asset"), null);
  assert.ok(listAssets({ kind: "glyph" }).length >= 1);
  assert.ok(listAssets().some((asset) => asset.id === "games-hero"));
  assert.ok(Object.isFrozen(ASSETS));
});

test("asset loader rejects absolute and traversal paths", async () => {
  await assert.rejects(loadAssetBuffer("../package.json"), /inside the assets/);
  await assert.rejects(loadAssetBuffer("/etc/passwd"), /relative path/);
  await assert.rejects(loadAssetBuffer(""), /relative path/);
});
