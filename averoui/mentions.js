function validateSnowflake(id, label) {
  if (typeof id !== "string" || !/^\d{17,20}$/.test(id)) {
    throw new TypeError(label + " ID must be a Discord snowflake string.");
  }
  return id;
}

export function userMention(id) {
  return "<@" + validateSnowflake(id, "User") + ">";
}

export function roleMention(id) {
  return "<@&" + validateSnowflake(id, "Role") + ">";
}

export function channelMention(id) {
  return "<#" + validateSnowflake(id, "Channel") + ">";
}
