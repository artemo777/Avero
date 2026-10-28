import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAsset } from "./assets.js";

const ASSET_ROOT = path.resolve(fileURLToPath(new URL("../assets/", import.meta.url)));
const ROOT_PREFIX = ASSET_ROOT + path.sep;

/**
 * Read an image/font/etc. stored in the repository-level assets/ folder.
 * Pass a relative path such as "icons/coin.png"; traversal outside assets/
 * is rejected. Files are loaded from disk, not downloaded at runtime.
 */
export async function loadAssetBuffer(relativePath) {
  if (typeof relativePath !== "string" || relativePath.trim() === "" || path.isAbsolute(relativePath)) {
    throw new TypeError("Asset path must be a non-empty relative path inside assets/.");
  }

  const resolvedPath = path.resolve(ASSET_ROOT, relativePath);
  if (!resolvedPath.startsWith(ROOT_PREFIX)) {
    throw new RangeError("Asset path must stay inside the assets/ directory.");
  }

  return readFile(resolvedPath);
}

/** Load a registered local SVG by catalogue ID. */
export async function loadRegisteredAsset(id) {
  const asset = getAsset(id);
  if (!asset || typeof asset.path !== "string") {
    throw new RangeError("Asset ID does not refer to a registered local file: " + id);
  }
  return loadAssetBuffer(asset.path);
}
