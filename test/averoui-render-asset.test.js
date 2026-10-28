import test from "node:test";
import assert from "node:assert/strict";
import { renderRegisteredAsset } from "../averoui/render-asset.js";
import { createEmbed } from "../averoui/embeds.js";

test("registered SVG artwork rasterizes to a PNG Discord can attach", async () => {
  const png = await renderRegisteredAsset("brand-mark-svg", 96);
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.ok(png.length > 100);
});

test("asset renderer validates output dimensions and registered IDs", async () => {
  await assert.rejects(renderRegisteredAsset("brand-mark-svg", 8), /from 16 to 2048/);
  await assert.rejects(renderRegisteredAsset("not-registered"), /does not refer to a registered local file/);
});

test("embeds accept local attachment thumbnail URLs only", () => {
  assert.equal(createEmbed({ title: "Profile", thumbnail: "attachment://avero-brand.png" }).thumbnail.url, "attachment://avero-brand.png");
  assert.throws(() => createEmbed({ title: "Profile", thumbnail: "https://example.com/icon.png" }), /local attachment/);
});
