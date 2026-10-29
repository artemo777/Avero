import { ICONS } from "./icons.js";
import { DISCORD_EMOJI } from "./discord-emojis.js";

export const ASSETS = Object.freeze({
  brandMark: Object.freeze({ id: "brand-mark", kind: "glyph", value: ICONS.brand, description: "Text-safe Avero brand mark", uses: Object.freeze(["headers", "loaders", "profile"]) }),
  loading: Object.freeze({ id: "loading", kind: "glyph", value: ICONS.loading, description: "Text-safe loading indicator", uses: Object.freeze(["loading-states", "deferred-panels"]) }),
  sparkle: Object.freeze({ id: "sparkle", kind: "glyph", value: ICONS.sparkle, description: "Accent sparkle", uses: Object.freeze(["rewards", "rarity", "milestones"]) }),
  coin: Object.freeze({ id: "coin", kind: "svg", path: "icons/coin.svg", description: "Original coin icon", uses: Object.freeze(["wallet", "rewards", "shop"]) }),
  gemCommon: Object.freeze({ id: "gem-common", kind: "svg", path: "icons/gem-common.svg", description: "Common rarity gem", uses: Object.freeze(["inventory", "item-details"]) }),
  gemRare: Object.freeze({ id: "gem-rare", kind: "svg", path: "icons/gem-rare.svg", description: "Rare rarity gem", uses: Object.freeze(["inventory", "item-details"]) }),
  gemEpic: Object.freeze({ id: "gem-epic", kind: "svg", path: "icons/gem-epic.svg", description: "Epic rarity gem", uses: Object.freeze(["inventory", "item-details"]) }),
  gemLegendary: Object.freeze({ id: "gem-legendary", kind: "svg", path: "icons/gem-legendary.svg", description: "Legendary rarity gem", uses: Object.freeze(["inventory", "item-details"]) }),
  badge: Object.freeze({ id: "badge", kind: "svg", path: "icons/badge.svg", description: "Avero collectible badge", uses: Object.freeze(["profiles", "milestones", "collection"]) }),
  rewardSparkle: Object.freeze({ id: "reward-sparkle", kind: "svg", path: "icons/reward-sparkle.svg", description: "Reward and milestone accent", uses: Object.freeze(["rewards", "milestones"]) }),
  loader: Object.freeze({ id: "loader", kind: "svg", path: "icons/loader.svg", description: "Static loading spinner artwork", uses: Object.freeze(["loading-states", "deferred-panels"]) }),
  brandMarkSvg: Object.freeze({ id: "brand-mark-svg", kind: "svg", path: "icons/brand-mark.svg", description: "Avero geometric brand mark", uses: Object.freeze(["headers", "profile", "canvas"]) }),
  collectibleNeonBadge: Object.freeze({ id: "collectible-neon-badge", kind: "svg", path: "icons/collectible-neon-badge.svg", description: "Original neon badge collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectibleVaultBadge: Object.freeze({ id: "collectible-vault-badge", kind: "svg", path: "icons/collectible-vault-badge.svg", description: "Original vault badge collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectibleStarlightBadge: Object.freeze({ id: "collectible-starlight-badge", kind: "svg", path: "icons/collectible-starlight-badge.svg", description: "Original starlight badge collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectibleMoonlitToken: Object.freeze({ id: "collectible-moonlit-token", kind: "svg", path: "icons/collectible-moonlit-token.svg", description: "Original moonlit token collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectiblePrismCrown: Object.freeze({ id: "collectible-prism-crown", kind: "svg", path: "icons/collectible-prism-crown.svg", description: "Original prism crown collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectibleAveroRelic: Object.freeze({ id: "collectible-avero-relic", kind: "svg", path: "icons/collectible-avero-relic.svg", description: "Original Avero relic collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  gamesHero: Object.freeze({ id: "games-hero", kind: "canvas", renderer: "renderAveroCanvas", description: "Generated Avero games and coins hero artwork", uses: Object.freeze(["games"]) })
});

const ASSET_SYMBOLS = Object.freeze({
  coin: ["wallet", "◉"],
  "gem-common": ["gemCommon", "◇"],
  "gem-rare": ["gemRare", "⬡"],
  "gem-epic": ["gemEpic", "✧"],
  "gem-legendary": ["gemLegendary", "✦"],
  badge: ["milestone", "⬢"],
  "reward-sparkle": ["daily", "✧"],
  loader: ["loader", "◌"],
  "brand-mark-svg": ["brand", "◈"]
});

export function getAssetSymbol(id) {
  const asset = getAsset(id);
  if (!asset) return "·";
  const mapping = ASSET_SYMBOLS[asset.id];
  if (!mapping) return asset.value ?? "·";
  return DISCORD_EMOJI[mapping[0]] ?? mapping[1];
}

export function getRarityAssetId(rarity) {
  const key = String(rarity ?? "").toLowerCase();
  if (key === "common") return "gem-common";
  if (["uncommon", "rare"].includes(key)) return "gem-rare";
  if (key === "epic") return "gem-epic";
  if (["legendary", "mythic"].includes(key)) return "gem-legendary";
  return "badge";
}

const COLLECTIBLE_ASSETS = Object.freeze({
  neon_badge: "collectible-neon-badge",
  vault_badge: "collectible-vault-badge",
  starlight_badge: "collectible-starlight-badge",
  moonlit_token: "collectible-moonlit-token",
  prism_crown: "collectible-prism-crown",
  avero_relic: "collectible-avero-relic"
});

export function getCollectibleAssetId(itemId) {
  return COLLECTIBLE_ASSETS[String(itemId ?? "")] ?? "badge";
}

export function getAsset(id) {
  return Object.values(ASSETS).find((asset) => asset.id === id) ?? null;
}

export function listAssets({ kind } = {}) {
  const entries = Object.values(ASSETS);
  return kind ? entries.filter((asset) => asset.kind === kind) : entries;
}
