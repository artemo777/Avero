export function createCommandMap(commands) {
  if (!Array.isArray(commands)) {
    throw new TypeError("Commands must be an array.");
  }

  const map = new Map();
  for (const command of commands) {
    const name = command?.data?.name;
    if (typeof name !== "string" || !/^[a-z0-9_-]{1,32}$/.test(name)) {
      throw new TypeError("Each command must have a valid lowercase Discord command name.");
    }
    if (typeof command.data.description !== "string" || command.data.description.length === 0) {
      throw new TypeError("Command " + name + " must have a description.");
    }
    if (typeof command.execute !== "function") {
      throw new TypeError("Command " + name + " must have an execute function.");
    }
    if (map.has(name)) {
      throw new Error("Duplicate command name: " + name);
    }
    map.set(name, command);
  }

  return map;
}

export function getCommandDefinitions(commands) {
  return [...createCommandMap(commands).values()].map((command) => command.data);
}

/**
 * Find guild-scoped commands that shadow commands registered globally.
 * Only overlapping names are removed; unrelated server-only commands are preserved.
 */
export function findGuildCommandDuplicates(guildCommands, globalDefinitions) {
  if (!Array.isArray(guildCommands) || !Array.isArray(globalDefinitions)) {
    throw new TypeError("Guild commands and global definitions must be arrays.");
  }
  const globalNames = new Set(globalDefinitions.map((command) => command?.name).filter(Boolean));
  return guildCommands.filter((command) => globalNames.has(command?.name));
}
