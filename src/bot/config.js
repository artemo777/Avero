import { parseLevelRoleRewards } from "./leveling.js";

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(name + " is required.");
  }
  return value.trim();
}

export function loadBotConfig(env = process.env) {
  return {
    token: requiredString(env.DISCORD_TOKEN, "DISCORD_TOKEN"),
    clientId: env.DISCORD_CLIENT_ID?.trim() || undefined,
    guildId: env.DISCORD_GUILD_ID?.trim() || undefined,
    levelRoleRewards: parseLevelRoleRewards(env.LEVEL_ROLE_REWARDS)
  };
}

export function requireApplicationId(config) {
  if (!config.clientId) {
    throw new Error("DISCORD_CLIENT_ID is required to register slash commands.");
  }
  return config.clientId;
}
