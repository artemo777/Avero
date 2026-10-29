/**
 * Avero's shared emoji catalogue.
 *
 * DISCORD_EMOJI always contains portable Unicode fallbacks so UI generated
 * for a different guild never accidentally emits custom emoji IDs from the
 * configured upload guild. Use getDiscordEmoji(key, guildId) only when the
 * current interaction's guild is known.
 */
const CUSTOM_EMOJI = Object.freeze({
  brand: ["AVERO_EMOJI_BRAND_ID", "avero_brand", "◈"],
  wallet: ["AVERO_EMOJI_COIN_ID", "avero_coin", "◉"],
  daily: ["AVERO_EMOJI_SPARKLE_ID", "avero_sparkle", "✨"],
  reward: ["AVERO_EMOJI_SPARKLE_ID", "avero_sparkle", "🎉"],
  milestone: ["AVERO_EMOJI_BADGE_ID", "avero_badge", "🏆"],
  loader: ["AVERO_EMOJI_LOADER_ID", "avero_loader", "◌"],
  gemCommon: ["AVERO_EMOJI_GEM_COMMON_ID", "avero_gem_common", "◇"],
  gemRare: ["AVERO_EMOJI_GEM_RARE_ID", "avero_gem_rare", "⬡"],
  gemEpic: ["AVERO_EMOJI_GEM_EPIC_ID", "avero_gem_epic", "✧"],
  gemLegendary: ["AVERO_EMOJI_GEM_LEGENDARY_ID", "avero_gem_legendary", "✦"],
  collectible: ["AVERO_EMOJI_BADGE_ID", "avero_badge", "🏅"]
});

const COLLECTIBLE_CUSTOM_EMOJI = Object.freeze({
  neon_badge: ["AVERO_EMOJI_NEON_BADGE_ID", "avero_neon_badge", "🌟"],
  vault_badge: ["AVERO_EMOJI_VAULT_BADGE_ID", "avero_vault_badge", "🔐"],
  starlight_badge: ["AVERO_EMOJI_STARLIGHT_BADGE_ID", "avero_starlight_badge", "✨"],
  moonlit_token: ["AVERO_EMOJI_MOONLIT_TOKEN_ID", "avero_moonlit_token", "🌙"],
  prism_crown: ["AVERO_EMOJI_PRISM_CROWN_ID", "avero_prism_crown", "👑"],
  avero_relic: ["AVERO_EMOJI_RELIC_ID", "avero_relic", "💠"]
});

function fallbackEmoji([, , fallback]) {
  return fallback;
}

function resolveCustomEmoji([envKey, name, fallback], guildId) {
  const sourceGuildId = process.env.DISCORD_GUILD_ID;
  const id = process.env[envKey];
  if (!guildId || !sourceGuildId || guildId !== sourceGuildId || !/^\\d{17,20}$/.test(id ?? "")) {
    return fallback;
  }
  return "<:" + name + ":" + id + ">";
}

export const DISCORD_EMOJI = Object.freeze({
  brand: fallbackEmoji(CUSTOM_EMOJI.brand),
  games: "🎮",
  guess: "🎯",
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
  shop: "🛍️",
  inventory: "🎒",
  wallet: fallbackEmoji(CUSTOM_EMOJI.wallet),
  work: "🧰",
  scavenge: "🔎",
  daily: fallbackEmoji(CUSTOM_EMOJI.daily),
  buy: "🛒",
  owned: "☑️",
  reward: fallbackEmoji(CUSTOM_EMOJI.reward),
  milestone: fallbackEmoji(CUSTOM_EMOJI.milestone),
  previous: "⬅️",
  next: "➡️",
  loader: fallbackEmoji(CUSTOM_EMOJI.loader),
  gemCommon: fallbackEmoji(CUSTOM_EMOJI.gemCommon),
  gemRare: fallbackEmoji(CUSTOM_EMOJI.gemRare),
  gemEpic: fallbackEmoji(CUSTOM_EMOJI.gemEpic),
  gemLegendary: fallbackEmoji(CUSTOM_EMOJI.gemLegendary),
  collectible: fallbackEmoji(CUSTOM_EMOJI.collectible),
  collectibles: Object.freeze(Object.fromEntries(
    Object.entries(COLLECTIBLE_CUSTOM_EMOJI).map(([id, config]) => [id, fallbackEmoji(config)])
  ))
});

/**
 * Resolve a custom emoji only for the configured source guild. Elsewhere the
 * portable Unicode fallback is returned.
 */
export function getDiscordEmoji(key, guildId) {
  if (key.startsWith("collectibles.")) {
    const itemId = key.slice("collectibles.".length);
    const config = COLLECTIBLE_CUSTOM_EMOJI[itemId];
    return config ? resolveCustomEmoji(config, guildId) : DISCORD_EMOJI.collectible;
  }
  const config = CUSTOM_EMOJI[key];
  return config ? resolveCustomEmoji(config, guildId) : (DISCORD_EMOJI[key] ?? "·");
}

export function getCollectibleEmoji(itemId, guildId) {
  return getDiscordEmoji("collectibles." + itemId, guildId);
}
