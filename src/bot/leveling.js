export const MESSAGE_XP_COOLDOWN_MS = 60_000;
export const MIN_MESSAGE_XP = 15;
export const MAX_MESSAGE_XP = 25;

export function randomMessageExperience(random = Math.random) {
  return MIN_MESSAGE_XP + Math.floor(random() * (MAX_MESSAGE_XP - MIN_MESSAGE_XP + 1));
}

export function parseLevelRoleRewards(value) {
  if (!value?.trim()) return {};

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("LEVEL_ROLE_REWARDS must be a JSON object mapping level numbers to Discord role IDs.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("LEVEL_ROLE_REWARDS must be a JSON object mapping level numbers to Discord role IDs.");
  }

  const rewards = {};
  for (const [rawLevel, roleId] of Object.entries(parsed)) {
    const level = Number(rawLevel);
    if (!Number.isSafeInteger(level) || level < 1 || typeof roleId !== "string" || !/^\d{17,20}$/.test(roleId)) {
      throw new Error("LEVEL_ROLE_REWARDS entries must use positive level numbers and valid Discord role IDs.");
    }
    rewards[level] = roleId;
  }
  return rewards;
}

export async function grantLevelRoleRewards(member, previousLevel, currentLevel, rewards) {
  if (!member || !rewards || currentLevel <= previousLevel) return [];

  const granted = [];
  for (const [rawLevel, roleId] of Object.entries(rewards)) {
    const level = Number(rawLevel);
    if (level <= previousLevel || level > currentLevel) continue;

    const role = member.guild.roles.cache.get(roleId);
    if (!role || member.roles.cache.has(roleId)) continue;

    await member.roles.add(role, "Avero level milestone reward");
    granted.push(level);
  }
  return granted;
}
