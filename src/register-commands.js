import { REST, Routes } from "discord.js";
import { commands } from "./bot/commands/index.js";
import { getCommandDefinitions } from "./bot/command-registry.js";
import {
  loadBotConfig,
  requireApplicationId,
  requireCommandRegistrationGuildIds
} from "./bot/config.js";

let config;
let guildIds;
try {
  config = loadBotConfig();
  requireApplicationId(config);
  guildIds = requireCommandRegistrationGuildIds(config);
} catch (error) {
  console.error("Slash-command registration configuration error: " + error.message);
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(config.token);
const body = getCommandDefinitions(commands);

try {
  for (const guildId of guildIds) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), { body });
    console.log("Registered " + commands.length + " Avero slash command(s) for allowed guild " + guildId + ".");
  }
} catch (error) {
  console.error("Slash-command registration failed:", error);
  process.exitCode = 1;
}
