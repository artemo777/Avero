/**
 * Runtime registry for custom emojis available to Avero across its shared servers.
 * Match whole name tokens (not arbitrary substrings) so "common" never matches
 * "uncommon", and "coin" never accidentally selects "coinflip".
 */
const PURPOSE_ALIASES = Object.freeze({
  coin: ["coin", "coins", "currency", "money", "gold", "wallet"],
  "gem-currency": ["gem_currency", "currency_gem", "crystal", "diamond", "gem"],
  "gem-common": ["gem_common", "common_gem", "common"],
  "gem-rare": ["gem_rare", "rare_gem", "rare"],
  "gem-epic": ["gem_epic", "epic_gem", "epic"],
  "gem-legendary": ["gem_legendary", "legendary_gem", "mythic_gem", "legendary", "mythic"],
  badge: ["badge", "medal", "achievement"],
  "reward-sparkle": ["reward", "sparkle", "star", "shiny", "milestone"],
  loader: ["loading", "loader", "spinner"],
  "brand-mark-svg": ["brand", "logo", "brand_mark", "avero_logo"],
  success: ["success", "check", "tick", "yes"],
  error: ["error", "cross", "fail"],
  warning: ["warning", "alert", "caution"],
  info: ["info", "information"],
  game: ["game", "controller", "gaming"],
  profile: ["profile", "user", "member"],
  crown: ["crown", "winner", "top"],
  shop: ["shop", "store", "shopping", "cart"],
  inventory: ["inventory", "backpack", "collection"],
  daily: ["daily", "calendar", "gift", "streak"],
  work: ["work", "toolbox", "briefcase", "career"],
  scavenge: ["scavenge", "search", "magnifying_glass", "explore"],
  guess: ["guess", "target", "dart", "bullseye"],
  vault: ["vault", "lock", "safe"],
  collections: ["collections", "collection", "atlas", "map"],
  settings: ["settings", "tools", "wrench", "gear", "configuration"],
  rock: ["rock", "fist"],
  paper: ["paper", "hand"],
  scissors: ["scissors", "shears"]
});

let availableEmojis = [];
const normalize = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const tokens = (value) => normalize(value).split("_").filter(Boolean);
const markup = (emoji) => "<" + (emoji.animated ? "a" : "") + ":" + emoji.name + ":" + emoji.id + ">";

function sequenceIndex(haystack, needle) {
  if (!needle.length || needle.length > haystack.length) return -1;
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    if (needle.every((token, offset) => haystack[index + offset] === token)) return index;
  }
  return -1;
}

export function setServerEmojis(emojis) {
  availableEmojis = [...(emojis ?? [])]
    .filter((emoji) => emoji && emoji.available !== false && emoji.id && emoji.name)
    .map((emoji) => ({ id: String(emoji.id), name: String(emoji.name), animated: Boolean(emoji.animated), normalized: normalize(emoji.name) }))
    .filter((emoji, index, all) => all.findIndex((candidate) => candidate.id === emoji.id) === index);
  return availableEmojis.length;
}

export function getServerEmoji(purpose, fallback = "") {
  const aliases = PURPOSE_ALIASES[purpose] ?? [normalize(purpose)];
  const ranked = availableEmojis.map((emoji) => {
    const emojiTokens = tokens(emoji.normalized);
    let score = 0;
    for (const value of aliases) {
      const alias = normalize(value);
      const aliasTokens = tokens(alias);
      if (!alias) continue;
      if (emoji.normalized === alias) score = Math.max(score, 1000 + alias.length);
      else {
        const index = sequenceIndex(emojiTokens, aliasTokens);
        if (index >= 0) {
          const edgeMatch = index === 0 || index + aliasTokens.length === emojiTokens.length;
          score = Math.max(score, (edgeMatch ? 800 : 600) + aliasTokens.length * 10 + alias.length);
        }
      }
    }
    return { emoji, score };
  }).filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.emoji.name.localeCompare(b.emoji.name) || a.emoji.id.localeCompare(b.emoji.id));
  return ranked.length ? markup(ranked[0].emoji) : fallback;
}

export function listServerEmojis() {
  return availableEmojis.map(({ id, name, animated }) => ({ id, name, animated }));
}
