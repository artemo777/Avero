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

export function findGuildCommandDuplicates(globalCommands, guildCommands) {
  if (!Array.isArray(globalCommands) || !Array.isArray(guildCommands)) {
    throw new TypeError("Global and guild commands must be arrays.");
  }
  const globalNames = new Set(globalCommands
    .map((command) => command?.name)
    .filter((name) => typeof name === "string"));
  return guildCommands.filter((command) => globalNames.has(command?.name));
}
