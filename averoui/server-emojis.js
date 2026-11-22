/**
 * Runtime registry for custom emojis available to Avero across its shared servers.
 * Match whole name tokens (not arbitrary substrings) so "common" never matches
 * "uncommon", and "coin" never accidentally selects "coinflip".
 */
const PURPOSE_ALIASES = Object.freeze({
  coin: ["goldenspincoin", "coin", "coins", "currency", "money", "gold", "wallet"],
  "gem-currency": ["orbsparklegemstone", "gem_currency", "currency_gem", "crystal", "diamond", "gem"],
  "gem-common": ["orbsparklegemstone", "gem_common", "common_gem", "common"],
  "gem-rare": ["orbsparklegemstone", "gem_rare", "rare_gem", "rare"],
  "gem-epic": ["orbsparklegemstone", "gem_epic", "epic_gem", "epic"],
  "gem-legendary": ["orbsparklegemstone", "gem_legendary", "legendary_gem", "mythic_gem", "legendary", "mythic"],
  badge: ["bughunter", "badge", "medal", "achievement"],
  "bughunter": ["bughunter"],
  "staff-member": ["staff"],
  check: ["check"],
  bullet: ["easydot_ids"],
  "reward-sparkle": ["sparkle1", "reward", "sparkle", "star", "shiny", "milestone"],
  loader: ["timersand", "loading", "loader", "spinner", "timer"],
  timer: ["timer"],
  cooldown: ["timersand", "timer"],
  "brand-mark-svg": ["icon", "brand", "logo", "brand_mark", "avero_logo"],
  success: ["verify", "check", "success", "tick", "yes"],
  win: ["platewwin", "duck_lesgo", "win", "winner"],
  error: ["slow_siren", "error", "cross", "fail"],
  warning: ["exclamation", "slow_siren", "warning", "alert", "caution"],
  info: ["icon", "info", "information"],
  game: ["duck_lesgo", "platewwin", "game", "controller", "gaming"],
  profile: ["icon", "profile", "user", "member"],
  crown: ["crown", "winner", "top"],
  shop: ["shop", "store", "shopping", "cart"],
  inventory: ["bag", "inventory", "backpack", "collection"],
  daily: ["timer", "daily", "calendar", "gift", "streak"],
  contracts: ["verify", "contract", "contracts", "quest", "mission"],
  work: ["timersand", "work", "toolbox", "briefcase", "career"],
  scavenge: ["scavenge", "search", "magnifying_glass", "explore"],
  guess: ["guess", "target", "dart", "bullseye"],
  vault: ["unlock", "vault", "lock", "safe"],
  collections: ["crown", "collections", "collection", "atlas", "map"],
  settings: ["adminroleicon", "settings", "tools", "wrench", "gear", "configuration"],
  rock: ["rock", "fist"],
  paper: ["paper", "hand"],
  scissors: ["scissors", "shears"],
  neon_badge: ["icon", "neon_badge", "avero_pin", "enamel_pin", "pin"],
  vault_badge: ["unlock", "vault_badge", "archive_key", "vault_key", "key"],
  starlight_badge: ["sparkle1", "starlight_badge", "signal_badge", "signal_pin", "signal"],
  moonlit_token: ["moonlit_token", "avero_hoodie", "hoodie", "sweatshirt"],
  prism_crown: ["crown", "prism_crown", "profile_frame", "frame"],
  avero_relic: ["platewwin", "avero_relic", "founders_medal", "medal"],
  support: ["dmforsupport_ids", "support", "helpdesk"],
  "money-request": ["trade_ids", "transaction", "transfer"],
  admin: ["adminroleicon", "admin", "administrator"],
  moderator: ["bluemodroleicon", "moderator", "mod"],
  staff: ["staffroleicon", "staff"],
  "staff-alert": ["alertastaff2000", "slow_siren"],
  bughunter: ["bughunter"],
  welcome: ["wavey"],
  celebration: ["rainbowwemoji", "duck_lesgo", "platewwin"],
  vip: ["vipgif"],
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
