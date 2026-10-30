import { REST, Routes } from "discord.js";
import { commands } from "./bot/commands/index.js";
import { getCommandDefinitions } from "./bot/command-registry.js";
import { loadBotConfig, requireApplicationId } from "./bot/config.js";

let config;
try {
  config = loadBotConfig();
  requireApplicationId(config);
  if (!config.guildId) {
    throw new Error("DISCORD_GUILD_ID is required for test-server command registration. No commands were changed.");
  }
} catch (error) {
  console.error("Guild slash-command registration configuration error: " + error.message);
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(config.token);
const body = getCommandDefinitions(commands);

try {
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });
  console.log(
    "Registered " + body.length + " Avero test-server slash command(s): " +
    body.map((command) => "/" + command.name).join(", ") + "."
  );
  console.log("Only DISCORD_GUILD_ID was updated. Global commands were not changed.");
} catch (error) {
  const status = Number(error?.status ?? error?.httpStatus ?? 0);
  const discordCode = String(error?.code ?? error?.rawError?.code ?? "");
  console.error("Test-server slash-command registration failed.");
  if (status === 401) {
    console.error("Discord rejected the bot token (401). Check the local DISCORD_TOKEN; do not paste it here.");
  } else {
    console.error("Discord API status:", status || "unknown", "code:", discordCode || "unknown");
    console.error(error?.message ?? "Unknown registration error.");
  }
  process.exitCode = 1;
}
