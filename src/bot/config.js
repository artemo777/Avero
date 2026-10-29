import { MESSAGE_XP_COOLDOWN_MS, MIN_MESSAGE_XP, MAX_MESSAGE_XP, parseLevelRoleRewards } from "./leveling.js";

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(name + " is required.");
  }
  return value.trim();
}

function optionalPositiveInteger(env, name, fallback) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  if (!/^[0-9]+$/.test(raw)) throw new Error(name + " must be a positive safe integer.");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(name + " must be a positive safe integer.");
  }
  return value;
}

function optionalChannelId(value) {
  const channelId = value?.trim();
  if (!channelId) return undefined;
  if (!/^[0-9]{17,20}$/.test(channelId)) {
    throw new Error("LEVEL_UP_CHANNEL_ID must be a valid Discord channel ID.");
  }
  return channelId;
}

export function loadBotConfig(env = process.env) {
  const minMessageXp = optionalPositiveInteger(env, "LEVEL_MIN_MESSAGE_XP", MIN_MESSAGE_XP);
  const maxMessageXp = optionalPositiveInteger(env, "LEVEL_MAX_MESSAGE_XP", MAX_MESSAGE_XP);
  if (maxMessageXp < minMessageXp) {
    throw new Error("LEVEL_MAX_MESSAGE_XP must be greater than or equal to LEVEL_MIN_MESSAGE_XP.");
  }

  return {
    token: requiredString(env.DISCORD_TOKEN, "DISCORD_TOKEN"),
    clientId: env.DISCORD_CLIENT_ID?.trim() || undefined,
    guildId: env.DISCORD_GUILD_ID?.trim() || undefined,
    levelRoleRewards: parseLevelRoleRewards(env.LEVEL_ROLE_REWARDS),
    levelUpChannelId: optionalChannelId(env.LEVEL_UP_CHANNEL_ID),
    messageXpCooldownMs: optionalPositiveInteger(env, "LEVEL_XP_COOLDOWN_MS", MESSAGE_XP_COOLDOWN_MS),
    minMessageXp,
    maxMessageXp
  };
}

export function requireApplicationId(config) {
  if (!config.clientId) {
    throw new Error("DISCORD_CLIENT_ID is required to register slash commands.");
  }
  return config.clientId;
}

