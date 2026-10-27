const DISCORD_TIMESTAMP_STYLES = new Set(["t", "T", "d", "D", "f", "F", "R"]);

export function discordTimestamp(value = new Date(), style = "F") {
  if (!DISCORD_TIMESTAMP_STYLES.has(style)) {
    throw new TypeError("Unsupported Discord timestamp style.");
  }

  const seconds = value instanceof Date
    ? Math.floor(value.getTime() / 1000)
    : value;

  if (!Number.isSafeInteger(seconds)) {
    throw new TypeError("Timestamp must be a valid Date or integer Unix timestamp in seconds.");
  }

  return "<t:" + seconds + ":" + style + ">";
}
