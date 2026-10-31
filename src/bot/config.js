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
    guildId: env.DISCORD_GUILD_ID?.trim() || undefined
  };
}

export function requireApplicationId(config) {
  const clientId = typeof config?.clientId === "string" ? config.clientId.trim() : "";
  if (!clientId) {
    throw new Error("DISCORD_CLIENT_ID is required to register global slash commands.");
  }
  return clientId;
}
