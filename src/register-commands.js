import { REST, Routes } from "discord.js";
import { commands } from "./bot/commands/index.js";
import { getCommandDefinitions } from "./bot/command-registry.js";
import {
  loadBotConfig,
  requireApplicationId
} from "./bot/config.js";

let config;
try {
  config = loadBotConfig();
  requireApplicationId(config);
} catch (error) {
  console.error("Slash-command registration configuration error: " + error.message);
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(config.token);
const body = getCommandDefinitions(commands);

try {
  await rest.put(Routes.applicationCommands(config.clientId), { body });
  console.log("Registered " + commands.length + " Avero global slash command(s).");
} catch (error) {
  console.error("Slash-command registration failed:", error);
  process.exitCode = 1;
}
