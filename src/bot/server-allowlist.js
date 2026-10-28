export function isAllowedGuild(guildId, allowedGuildIds) {
  return typeof guildId === "string" && allowedGuildIds.includes(guildId);
}
