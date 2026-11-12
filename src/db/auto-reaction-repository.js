const CACHE_TTL_MS = 5000;
const settingsCache = new Map();

function requireGuildId(guildId) {
  if (typeof guildId !== "string" || !/^\d{17,20}$/.test(guildId)) throw new TypeError("guildId must be a valid Discord server ID.");
  return guildId;
}
function cacheSettings(settings) {
  settingsCache.set(settings.guildId, { value: settings, expiresAt: Date.now() + CACHE_TTL_MS });
  return settings;
}
export async function getAutoReactionSettings(prisma, guildId, { force = false } = {}) {
  const key = requireGuildId(guildId);
  const cached = settingsCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value;
  const settings = await prisma.autoReactionSetting.upsert({
    where: { guildId: key }, create: { guildId: key }, update: {}
  });
  return cacheSettings(settings);
}
export async function updateAutoReactionSettings(prisma, guildId, input) {
  const key = requireGuildId(guildId);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Auto-reaction settings must be an object.");
  const data = {};
  if (Object.hasOwn(input, "enabled")) {
    if (typeof input.enabled !== "boolean") throw new TypeError("enabled must be true or false.");
    data.enabled = input.enabled;
  }
  if (Object.hasOwn(input, "emoji")) {
    if (input.emoji !== null && (typeof input.emoji !== "string" || !input.emoji.trim() || input.emoji.length > 100)) {
      throw new TypeError("emoji must be a non-empty string up to 100 characters or null.");
    }
    data.emoji = input.emoji === null ? null : input.emoji.trim();
  }
  if (Object.hasOwn(input, "ignoredChannelIds")) {
    if (!Array.isArray(input.ignoredChannelIds) || input.ignoredChannelIds.some((id) => typeof id !== "string" || !/^\d{17,20}$/.test(id))) {
      throw new TypeError("ignoredChannelIds must contain valid Discord channel IDs.");
    }
    data.ignoredChannelIds = [...new Set(input.ignoredChannelIds)];
  }
  if (!Object.keys(data).length) throw new TypeError("No auto-reaction settings were supplied.");
  const settings = await prisma.autoReactionSetting.upsert({
    where: { guildId: key }, create: { guildId: key, ...data }, update: data
  });
  settingsCache.delete(key);
  return cacheSettings(settings);
}
export async function addIgnoredChannel(prisma, guildId, channelId) {
  const current = await getAutoReactionSettings(prisma, guildId);
  if (current.ignoredChannelIds.includes(channelId)) return current;
  return updateAutoReactionSettings(prisma, guildId, { ignoredChannelIds: [...current.ignoredChannelIds, channelId] });
}
export async function removeIgnoredChannel(prisma, guildId, channelId) {
  const current = await getAutoReactionSettings(prisma, guildId);
  if (!current.ignoredChannelIds.includes(channelId)) return current;
  return updateAutoReactionSettings(prisma, guildId, { ignoredChannelIds: current.ignoredChannelIds.filter((id) => id !== channelId) });
}


const rolePerkCache = new Map();
function requireTargetId(targetId, label) {
  if (typeof targetId !== "string" || !/^\d{17,20}$/.test(targetId)) throw new TypeError(label + " must be a valid Discord ID.");
  return targetId;
}
function cacheRolePerks(guildId, perks) {
  rolePerkCache.set(guildId, { value: perks, expiresAt: Date.now() + CACHE_TTL_MS });
  return perks;
}
export async function getAutoReactionRolePerks(prisma, guildId, { force = false } = {}) {
  const key = requireGuildId(guildId);
  const cached = rolePerkCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value;
  const perks = await prisma.autoReactionRolePerk.findMany({
    where: { guildId: key },
    orderBy: [{ createdAt: "asc" }, { roleId: "asc" }, { userId: "asc" }]
  });
  return cacheRolePerks(key, perks);
}
export async function upsertAutoReactionRolePerk(prisma, guildId, roleId, emoji) {
  const key = requireGuildId(guildId);
  const role = requireTargetId(roleId, "roleId");
  if (typeof emoji !== "string" || !emoji.trim() || emoji.length > 100) {
    throw new TypeError("emoji must be a non-empty string up to 100 characters.");
  }
  const perk = await prisma.autoReactionRolePerk.upsert({
    where: { guildId_roleId: { guildId: key, roleId: role } },
    create: { guildId: key, roleId: role, emoji: emoji.trim() },
    update: { emoji: emoji.trim() }
  });
  rolePerkCache.delete(key);
  return perk;
}
export async function removeAutoReactionRolePerk(prisma, guildId, roleId) {
  const key = requireGuildId(guildId);
  const role = requireTargetId(roleId, "roleId");
  const result = await prisma.autoReactionRolePerk.deleteMany({
    where: { guildId: key, roleId: role }
  });
  rolePerkCache.delete(key);
  return result.count;
}

export async function upsertAutoReactionUserPerk(prisma, guildId, userId, emoji) {
  const key = requireGuildId(guildId);
  const user = requireTargetId(userId, "userId");
  if (typeof emoji !== "string" || !emoji.trim() || emoji.length > 100) throw new TypeError("emoji must be a non-empty string up to 100 characters.");
  const perk = await prisma.autoReactionRolePerk.upsert({
    where: { guildId_userId: { guildId: key, userId: user } },
    create: { guildId: key, userId: user, roleId: null, emoji: emoji.trim() },
    update: { emoji: emoji.trim() }
  });
  rolePerkCache.delete(key);
  return perk;
}
export async function removeAutoReactionUserPerk(prisma, guildId, userId) {
  const key = requireGuildId(guildId);
  const user = requireTargetId(userId, "userId");
  const result = await prisma.autoReactionRolePerk.deleteMany({ where: { guildId: key, userId: user } });
  rolePerkCache.delete(key);
  return result.count;
}
