/**
 * Centralized Discord-native emoji pack for Avero interactions.
 *
 * These Unicode emoji are safe defaults for button labels and message text.
 * Server custom emoji can be mapped here later without scattering IDs through
 * game logic. Keep text-safe UI glyphs in icons.js and SVG artwork in assets.js.
 */
export const DISCORD_EMOJI = Object.freeze({
  brand: "◈",
  games: "🎮",
  guess: "🎯",
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
  shop: "🛍️",
  inventory: "🎒",
  wallet: "🪙",
  work: "🧰",
  scavenge: "🔎",
  daily: "✨",
  buy: "🛒",
  owned: "☑️",
  reward: "🎉",
  milestone: "🏆",
  previous: "⬅️",
  next: "➡️",
  collectible: "🏅",
  collectibles: Object.freeze({
    neon_badge: "🌟",
    vault_badge: "🔐",
    starlight_badge: "✨",
    moonlit_token: "🌙",
    prism_crown: "👑",
    avero_relic: "💠"
  })
});

export function getCollectibleEmoji(itemId) {
  return DISCORD_EMOJI.collectibles[itemId] ?? DISCORD_EMOJI.collectible;
}
