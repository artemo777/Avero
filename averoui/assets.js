import { ICONS } from "./icons.js";

/**
 * Shared asset catalogue for UI glyphs and local artwork.
 *
 * Put binary artwork in the repository-level assets/ directory and register
 * its relative path here. Keep source and licence details for third-party art.
 * Prefer original Avero artwork or assets with a licence that allows reuse.
 */
export const ASSETS = Object.freeze({
  brandMark: Object.freeze({ id: "brand-mark", kind: "glyph", value: ICONS.brand, description: "Text-safe Avero brand mark", uses: Object.freeze(["headers", "loaders", "profile"]) }),
  loading: Object.freeze({ id: "loading", kind: "glyph", value: ICONS.loading, description: "Text-safe loading indicator", uses: Object.freeze(["loading-states", "deferred-panels"]) }),
  sparkle: Object.freeze({ id: "sparkle", kind: "glyph", value: ICONS.sparkle, description: "Accent sparkle", uses: Object.freeze(["rewards", "rarity", "milestones"]) }),
  coin: Object.freeze({ id: "coin", kind: "svg", path: "icons/coin.svg", description: "Original coin icon", uses: Object.freeze(["wallet","rewards","shop"]) }),
  gemCommon: Object.freeze({ id: "gem-common", kind: "svg", path: "icons/gem-common.svg", description: "Common rarity gem", uses: Object.freeze(["inventory","item-details"]) }),
  gemRare: Object.freeze({ id: "gem-rare", kind: "svg", path: "icons/gem-rare.svg", description: "Rare rarity gem", uses: Object.freeze(["inventory","item-details"]) }),
  gemEpic: Object.freeze({ id: "gem-epic", kind: "svg", path: "icons/gem-epic.svg", description: "Epic rarity gem", uses: Object.freeze(["inventory","item-details"]) }),
  gemLegendary: Object.freeze({ id: "gem-legendary", kind: "svg", path: "icons/gem-legendary.svg", description: "Legendary rarity gem", uses: Object.freeze(["inventory","item-details"]) }),
  badge: Object.freeze({ id: "badge", kind: "svg", path: "icons/badge.svg", description: "Avero collectible badge", uses: Object.freeze(["profiles","milestones","collection"]) }),
  rewardSparkle: Object.freeze({ id: "reward-sparkle", kind: "svg", path: "icons/reward-sparkle.svg", description: "Reward and milestone accent", uses: Object.freeze(["rewards","milestones"]) }),
  loader: Object.freeze({ id: "loader", kind: "svg", path: "icons/loader.svg", description: "Static loading spinner artwork", uses: Object.freeze(["loading-states","deferred-panels"]) }),
  brandMarkSvg: Object.freeze({ id: "brand-mark-svg", kind: "svg", path: "icons/brand-mark.svg", description: "Avero geometric brand mark", uses: Object.freeze(["headers","profile","canvas"]) }),
  gamesHero: Object.freeze({ id: "games-hero", kind: "canvas", renderer: "renderAveroCanvas", description: "Generated Avero games and coins hero artwork", uses: Object.freeze(["games"]) })
});

export function getAsset(id) {
  return Object.values(ASSETS).find((asset) => asset.id === id) ?? null;
}

export function listAssets({ kind } = {}) {
  const entries = Object.values(ASSETS);
  return kind ? entries.filter((asset) => asset.kind === kind) : entries;
}
