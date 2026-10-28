import { ICONS } from "./icons.js";

/**
 * Shared asset catalogue for UI glyphs and local artwork.
 *
 * Put binary artwork in the repository-level assets/ directory and register
 * its relative path here. Keep source and licence details for third-party art.
 * Prefer original Avero artwork or assets with a licence that allows reuse.
 */
export const ASSETS = Object.freeze({
  brandMark: Object.freeze({
    id: "brand-mark",
    kind: "glyph",
    value: ICONS.brand,
    description: "Avero's compact brand mark",
    uses: Object.freeze(["headers", "loaders", "profile"])
  }),
  loading: Object.freeze({
    id: "loading",
    kind: "glyph",
    value: ICONS.loading,
    description: "Text-safe loading indicator",
    uses: Object.freeze(["loading-states", "deferred-panels"])
  }),
  sparkle: Object.freeze({
    id: "sparkle",
    kind: "glyph",
    value: ICONS.sparkle,
    description: "Accent sparkle",
    uses: Object.freeze(["rewards", "rarity", "milestones"])
  }),
  gamesHero: Object.freeze({
    id: "games-hero",
    kind: "canvas",
    renderer: "renderAveroCanvas",
    description: "Generated Avero games and coins hero artwork",
    uses: Object.freeze(["games"])
  })
});

export function getAsset(id) {
  return Object.values(ASSETS).find((asset) => asset.id === id) ?? null;
}

export function listAssets({ kind } = {}) {
  const entries = Object.values(ASSETS);
  return kind ? entries.filter((asset) => asset.kind === kind) : entries;
}
