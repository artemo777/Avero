import { createCanvas, loadImage } from "@napi-rs/canvas";
import { loadRegisteredAsset } from "./asset-loader.js";

/**
 * Convert a registered SVG asset into a PNG attachment that Discord can render.
 * Source artwork remains SVG in assets/; raster output is generated on demand.
 */
export async function renderRegisteredAsset(id, size = 256) {
  if (!Number.isSafeInteger(size) || size < 16 || size > 2048) {
    throw new RangeError("Asset render size must be an integer from 16 to 2048.");
  }

  const source = await loadRegisteredAsset(id);
  const image = await loadImage(source);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  context.drawImage(image, 0, 0, size, size);
  return canvas.toBuffer("image/png");
}
