const DEFAULTS = Object.freeze({
  gamesEnabled: true, currencyEnabled: true, dailyReward: 100,
  workMinReward: 60, workMaxReward: 120,
  boosterRoleId: null, funderRoleId: null, voterRoleId: null
});
const ROLE_FIELDS = new Set(["boosterRoleId", "funderRoleId", "voterRoleId"]);
const BOOLEAN_FIELDS = new Set(["gamesEnabled", "currencyEnabled"]);
const INTEGER_LIMITS = Object.freeze({
  dailyReward: [1, 100000], workMinReward: [1, 100000], workMaxReward: [1, 100000]
});
function requireGuildId(guildId) {
  if (typeof guildId !== "string" || !/^\d{17,20}$/.test(guildId)) throw new TypeError("guildId must be a valid Discord server ID.");
  return guildId;
}
function validateSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Guild settings must be an object.");
  const data = {};
  for (const [field, value] of Object.entries(input)) {
    if (BOOLEAN_FIELDS.has(field)) {
      if (typeof value !== "boolean") throw new TypeError(field + " must be true or false.");
      data[field] = value;
    } else if (INTEGER_LIMITS[field]) {
      const [min, max] = INTEGER_LIMITS[field];
      if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(field + " must be between " + min + " and " + max + ".");
      data[field] = value;
    } else if (ROLE_FIELDS.has(field)) {
      if (value !== null && (typeof value !== "string" || !/^\d{17,20}$/.test(value))) throw new TypeError(field + " must be a valid Discord role ID or blank.");
      data[field] = value;
    } else throw new TypeError("Unsupported guild setting: " + field + ".");
  }
  return data;
}
export async function getGuildSettings(prisma, guildId) {
  const key = requireGuildId(guildId);
  return prisma.guildSettings.upsert({ where: { guildId: key }, create: { guildId: key, ...DEFAULTS }, update: {} });
}
export async function updateGuildSettings(prisma, guildId, input) {
  const key = requireGuildId(guildId);
  const data = validateSettings(input);
  if (!Object.keys(data).length) throw new TypeError("No settings were supplied.");
  const current = await getGuildSettings(prisma, key);
  const nextMin = data.workMinReward ?? current.workMinReward;
  const nextMax = data.workMaxReward ?? current.workMaxReward;
  if (nextMin > nextMax) throw new RangeError("Work minimum reward cannot exceed the maximum.");
  return prisma.guildSettings.update({ where: { guildId: key }, data });
}
export const GUILD_SETTINGS_DEFAULTS = DEFAULTS;