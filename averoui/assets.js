import { ICONS } from "./icons.js";
import { getServerEmoji } from "./server-emojis.js";

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
  collectibleNeonBadge: Object.freeze({ id: "collectible-neon-badge", kind: "svg", path: "icons/collectible-neon-badge.svg", description: "Original neon badge collectible artwork", uses: Object.freeze(["shop","inventory","item-details"]) }),
  collectibleVaultBadge: Object.freeze({ id: "collectible-vault-badge", kind: "svg", path: "icons/collectible-vault-badge.svg", description: "Original vault badge collectible artwork", uses: Object.freeze(["shop","inventory","item-details"]) }),
  collectibleStarlightBadge: Object.freeze({ id: "collectible-starlight-badge", kind: "svg", path: "icons/collectible-starlight-badge.svg", description: "Original starlight badge collectible artwork", uses: Object.freeze(["shop","inventory","item-details"]) }),
  collectibleMoonlitToken: Object.freeze({ id: "collectible-moonlit-token", kind: "svg", path: "icons/collectible-moonlit-token.svg", description: "Original moonlit token collectible artwork", uses: Object.freeze(["shop","inventory","item-details"]) }),
  collectiblePrismCrown: Object.freeze({ id: "collectible-prism-crown", kind: "svg", path: "icons/collectible-prism-crown.svg", description: "Original prism crown collectible artwork", uses: Object.freeze(["shop","inventory","item-details"]) }),
  collectibleAveroRelic: Object.freeze({ id: "collectible-avero-relic", kind: "svg", path: "icons/collectible-avero-relic.svg", description: "Original Avero relic collectible artwork", uses: Object.freeze(["shop","inventory","item-details"]) }),
  collectible_pixel_cape: Object.freeze({ id: "collectible-pixel-cape", kind: "svg", path: "icons/collectible-pixel-cape.svg", description: "Original Pixel Cape shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_cloud_specs: Object.freeze({ id: "collectible-cloud-specs", kind: "svg", path: "icons/collectible-cloud-specs.svg", description: "Original Cloud Specs shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_star_pin: Object.freeze({ id: "collectible-star-pin", kind: "svg", path: "icons/collectible-star-pin.svg", description: "Original Star Pin shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_mossy_mug: Object.freeze({ id: "collectible-mossy-mug", kind: "svg", path: "icons/collectible-mossy-mug.svg", description: "Original Mossy Mug shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_paper_crown: Object.freeze({ id: "collectible-paper-crown", kind: "svg", path: "icons/collectible-paper-crown.svg", description: "Original Paper Crown shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_comet_trail: Object.freeze({ id: "collectible-comet-trail", kind: "svg", path: "icons/collectible-comet-trail.svg", description: "Original Comet Trail shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_tiny_trophy: Object.freeze({ id: "collectible-tiny-trophy", kind: "svg", path: "icons/collectible-tiny-trophy.svg", description: "Original Tiny Trophy shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_halo_ring: Object.freeze({ id: "collectible-halo-ring", kind: "svg", path: "icons/collectible-halo-ring.svg", description: "Original Halo Ring shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_orbit_spark: Object.freeze({ id: "collectible-orbit-spark", kind: "svg", path: "icons/collectible-orbit-spark.svg", description: "Original Orbit Sparks shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_pixel_wings: Object.freeze({ id: "collectible-pixel-wings", kind: "svg", path: "icons/collectible-pixel-wings.svg", description: "Original Pixel Wings shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_library_card: Object.freeze({ id: "collectible-library-card", kind: "svg", path: "icons/collectible-library-card.svg", description: "Original Library Card shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_lucky_compass: Object.freeze({ id: "collectible-lucky-compass", kind: "svg", path: "icons/collectible-lucky-compass.svg", description: "Original Lucky Compass shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_repair_kit: Object.freeze({ id: "collectible-repair-kit", kind: "svg", path: "icons/collectible-repair-kit.svg", description: "Original Repair Kit shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_field_notebook: Object.freeze({ id: "collectible-field-notebook", kind: "svg", path: "icons/collectible-field-notebook.svg", description: "Original Field Notebook shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_hourglass: Object.freeze({ id: "collectible-hourglass", kind: "svg", path: "icons/collectible-hourglass.svg", description: "Original Pocket Hourglass shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_aurora_frame: Object.freeze({ id: "collectible-aurora-frame", kind: "svg", path: "icons/collectible-aurora-frame.svg", description: "Original Aurora Frame shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_crystal_badge: Object.freeze({ id: "collectible-crystal-badge", kind: "svg", path: "icons/collectible-crystal-badge.svg", description: "Original Crystal Scholar shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_starlight_compass: Object.freeze({ id: "collectible-starlight-compass", kind: "svg", path: "icons/collectible-starlight-compass.svg", description: "Original Starlight Compass shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_nebula_cape: Object.freeze({ id: "collectible-nebula-cape", kind: "svg", path: "icons/collectible-nebula-cape.svg", description: "Original Nebula Cape shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_golden_owl: Object.freeze({ id: "collectible-golden-owl", kind: "svg", path: "icons/collectible-golden-owl.svg", description: "Original Golden Owl shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_archive_key: Object.freeze({ id: "collectible-archive-key", kind: "svg", path: "icons/collectible-archive-key.svg", description: "Original Archive Key shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_coin_pouch: Object.freeze({ id: "collectible-coin-pouch", kind: "svg", path: "icons/collectible-coin-pouch.svg", description: "Original Coin Pouch shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_mint_token: Object.freeze({ id: "collectible-mint-token", kind: "svg", path: "icons/collectible-mint-token.svg", description: "Original Mint Token shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_starter_badge: Object.freeze({ id: "collectible-starter-badge", kind: "svg", path: "icons/collectible-starter-badge.svg", description: "Original Tiny Trailblazer shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_paper_star: Object.freeze({ id: "collectible-paper-star", kind: "svg", path: "icons/collectible-paper-star.svg", description: "Original Paper Star shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_sleepy_cloud: Object.freeze({ id: "collectible-sleepy-cloud", kind: "svg", path: "icons/collectible-sleepy-cloud.svg", description: "Original Sleepy Cloud shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_blueprint_frame: Object.freeze({ id: "collectible-blueprint-frame", kind: "svg", path: "icons/collectible-blueprint-frame.svg", description: "Original Blueprint Frame shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_mono_frame: Object.freeze({ id: "collectible-mono-frame", kind: "svg", path: "icons/collectible-mono-frame.svg", description: "Original Mono Frame shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_chibi_frame: Object.freeze({ id: "collectible-chibi-frame", kind: "svg", path: "icons/collectible-chibi-frame.svg", description: "Original Professor Chibi Frame shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_cobalt_frame: Object.freeze({ id: "collectible-cobalt-frame", kind: "svg", path: "icons/collectible-cobalt-frame.svg", description: "Original Cobalt Orbit Frame shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_frost_frame: Object.freeze({ id: "collectible-frost-frame", kind: "svg", path: "icons/collectible-frost-frame.svg", description: "Original Frostline Frame shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_ember_frame: Object.freeze({ id: "collectible-ember-frame", kind: "svg", path: "icons/collectible-ember-frame.svg", description: "Original Ember Frame shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_starlight_frame: Object.freeze({ id: "collectible-starlight-frame", kind: "svg", path: "icons/collectible-starlight-frame.svg", description: "Original Starlight Frame shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_professor_badge: Object.freeze({ id: "collectible-professor-badge", kind: "svg", path: "icons/collectible-professor-badge.svg", description: "Original Professor's Assistant shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  collectible_night_owl_badge: Object.freeze({ id: "collectible-night-owl-badge", kind: "svg", path: "icons/collectible-night-owl-badge.svg", description: "Original Night Owl shop collectible artwork", uses: Object.freeze(["shop", "inventory", "item-details"]) }),
  mascotProfessor: Object.freeze({ id: "mascot-professor", kind: "svg", path: "icons/mascot-professor.svg", description: "Original Avero chibi professor mascot", uses: Object.freeze(["welcome", "help", "profile", "loading"]) }),
  gamesHero: Object.freeze({ id: "games-hero", kind: "canvas", renderer: "renderAveroCanvas", description: "Generated Avero games and coins hero artwork", uses: Object.freeze(["games"]) })
});

const ASSET_SYMBOLS = Object.freeze({
  coin: "◉", "gem-common": "◇", "gem-rare": "⬡", "gem-epic": "✧",
  "gem-legendary": "✦", badge: "⬢", "reward-sparkle": "✧", loader: "◌", "brand-mark-svg": "◈"
});

export function getAssetSymbol(id) {
  const asset = getAsset(id);
  if (!asset) return "·";
  return getServerEmoji(asset.id, ASSET_SYMBOLS[asset.id] ?? asset.value ?? "·");
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
  avero_relic: "collectible-avero-relic",
  pixel_cape: "collectible-pixel-cape",
  cloud_specs: "collectible-cloud-specs",
  star_pin: "collectible-star-pin",
  mossy_mug: "collectible-mossy-mug",
  paper_crown: "collectible-paper-crown",
  comet_trail: "collectible-comet-trail",
  tiny_trophy: "collectible-tiny-trophy",
  halo_ring: "collectible-halo-ring",
  orbit_spark: "collectible-orbit-spark",
  pixel_wings: "collectible-pixel-wings",
  library_card: "collectible-library-card",
  lucky_compass: "collectible-lucky-compass",
  repair_kit: "collectible-repair-kit",
  field_notebook: "collectible-field-notebook",
  hourglass: "collectible-hourglass",
  aurora_frame: "collectible-aurora-frame",
  crystal_badge: "collectible-crystal-badge",
  starlight_compass: "collectible-starlight-compass",
  nebula_cape: "collectible-nebula-cape",
  golden_owl: "collectible-golden-owl",
  archive_key: "collectible-archive-key",
  coin_pouch: "collectible-coin-pouch",
  mint_token: "collectible-mint-token",
  starter_badge: "collectible-starter-badge",
  paper_star: "collectible-paper-star",
  sleepy_cloud: "collectible-sleepy-cloud",
  blueprint_frame: "collectible-blueprint-frame",
  mono_frame: "collectible-mono-frame",
  chibi_frame: "collectible-chibi-frame",
  cobalt_frame: "collectible-cobalt-frame",
  frost_frame: "collectible-frost-frame",
  ember_frame: "collectible-ember-frame",
  starlight_frame: "collectible-starlight-frame",
  professor_badge: "collectible-professor-badge",
  night_owl_badge: "collectible-night-owl-badge"
});

const CATEGORY_ASSETS = Object.freeze({
  badges: "collectible-neon-badge",
  cosmetics: "collectible-prism-crown",
  tools: "collectible-vault-badge",
  coins: "coin"
});

export function getCollectibleAssetId(itemId, category = null) {
  return COLLECTIBLE_ASSETS[String(itemId ?? "")] ?? CATEGORY_ASSETS[category] ?? "badge";
}

export function getAsset(id) {
  return Object.values(ASSETS).find((asset) => asset.id === id) ?? null;
}

export function listAssets({ kind } = {}) {
  const entries = Object.values(ASSETS);
  return kind ? entries.filter((asset) => asset.kind === kind) : entries;
}
