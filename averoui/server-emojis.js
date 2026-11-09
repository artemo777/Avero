/**
 * Runtime registry for custom emojis available to Avero across its shared servers.
 * Emoji names are matched semantically so each UI purpose can use server artwork
 * without hard-coding IDs that may differ between environments.
 */
const PURPOSE_ALIASES = Object.freeze({
  coin: ["coin", "coins", "currency", "money", "gold", "wallet"],
  "gem-common": ["gem_common", "common_gem", "common"],
  "gem-rare": ["gem_rare", "rare_gem"],
  "gem-epic": ["gem_epic", "epic_gem"],
  "gem-legendary": ["gem_legendary", "legendary_gem", "mythic_gem"],
  badge: ["badge", "medal", "achievement"],
  "reward-sparkle": ["reward", "sparkle", "star", "shiny"],
  loader: ["loading", "loader", "spinner"],
  "brand-mark-svg": ["avero", "brand", "logo"],
  success: ["success", "check", "tick", "yes"],
  error: ["error", "cross", "no", "fail"],
  warning: ["warning", "alert", "caution"],
  info: ["info", "information"],
  game: ["game", "controller", "gaming"],
  profile: ["profile", "user", "member"],
  crown: ["crown", "winner", "top"]
});

let availableEmojis = [];
const normalize = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const markup = (emoji) => "<" + (emoji.animated ? "a" : "") + ":" + emoji.name + ":" + emoji.id + ">";

export function setServerEmojis(emojis) {
  availableEmojis = [...(emojis ?? [])]
    .filter((emoji) => emoji && emoji.available !== false && emoji.id && emoji.name)
    .map((emoji) => ({ id: String(emoji.id), name: String(emoji.name), animated: Boolean(emoji.animated), normalized: normalize(emoji.name) }));
  return availableEmojis.length;
}

export function getServerEmoji(purpose, fallback = "") {
  const aliases = PURPOSE_ALIASES[purpose] ?? [normalize(purpose)];
  const ranked = availableEmojis.map((emoji) => {
    let score = 0;
    for (const value of aliases) {
      const alias = normalize(value);
      if (!alias) continue;
      if (emoji.normalized === alias) score = Math.max(score, 100 + alias.length);
      else if (emoji.normalized.startsWith(alias + "_") || emoji.normalized.endsWith("_" + alias)) score = Math.max(score, 70 + alias.length);
      else if (emoji.normalized.includes(alias)) score = Math.max(score, 40 + alias.length);
    }
    return { emoji, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || a.emoji.name.localeCompare(b.emoji.name));
  return ranked.length ? markup(ranked[0].emoji) : fallback;
}

export function listServerEmojis() {
  return availableEmojis.map(({ id, name, animated }) => ({ id, name, animated }));
}
