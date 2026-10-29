/**
 * Avero's shared emoji catalogue.
 *
 * Unicode symbols remain the fallback. After running
 * `npm run discord:upload-emojis`, paste the printed IDs into the private
 * environment used by the bot to enable the original server custom emoji.
 */
function customEmoji(envKey, name, fallback) {
  const id = process.env[envKey];
  return /^\d{17,20}$/.test(id ?? "") ? "<:" + name + ":" + id + ">" : fallback;
}

export const DISCORD_EMOJI = Object.freeze({
  brand: customEmoji("AVERO_EMOJI_BRAND_ID", "avero_brand", "◈"),
  games: "🎮",
  guess: "🎯",
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
  shop: "🛍️",
  inventory: "🎒",
  wallet: customEmoji("AVERO_EMOJI_COIN_ID", "avero_coin", "🪙"),
  work: "🧰",
  scavenge: "🔎",
  daily: customEmoji("AVERO_EMOJI_SPARKLE_ID", "avero_sparkle", "✨"),
  buy: "🛒",
  owned: "☑️",
  reward: customEmoji("AVERO_EMOJI_SPARKLE_ID", "avero_sparkle", "🎉"),
  milestone: customEmoji("AVERO_EMOJI_BADGE_ID", "avero_badge", "🏆"),
  previous: "⬅️",
  next: "➡️",
  loader: customEmoji("AVERO_EMOJI_LOADER_ID", "avero_loader", "◌"),
  gemCommon: customEmoji("AVERO_EMOJI_GEM_COMMON_ID", "avero_gem_common", "◇"),
  gemRare: customEmoji("AVERO_EMOJI_GEM_RARE_ID", "avero_gem_rare", "⬡"),
  gemEpic: customEmoji("AVERO_EMOJI_GEM_EPIC_ID", "avero_gem_epic", "✧"),
  gemLegendary: customEmoji("AVERO_EMOJI_GEM_LEGENDARY_ID", "avero_gem_legendary", "✦"),
  collectible: customEmoji("AVERO_EMOJI_BADGE_ID", "avero_badge", "🏅"),
  collectibles: Object.freeze({
    neon_badge: customEmoji("AVERO_EMOJI_NEON_BADGE_ID", "avero_neon_badge", "🌟"),
    vault_badge: customEmoji("AVERO_EMOJI_VAULT_BADGE_ID", "avero_vault_badge", "🔐"),
    starlight_badge: customEmoji("AVERO_EMOJI_STARLIGHT_BADGE_ID", "avero_starlight_badge", "✨"),
    moonlit_token: customEmoji("AVERO_EMOJI_MOONLIT_TOKEN_ID", "avero_moonlit_token", "🌙"),
    prism_crown: customEmoji("AVERO_EMOJI_PRISM_CROWN_ID", "avero_prism_crown", "👑"),
    avero_relic: customEmoji("AVERO_EMOJI_RELIC_ID", "avero_relic", "💠")
  })
});

export function getCollectibleEmoji(itemId) {
  return DISCORD_EMOJI.collectibles[itemId] ?? DISCORD_EMOJI.collectible;
}
