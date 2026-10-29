import { REST, Routes } from "discord.js";
import { commands } from "./bot/commands/index.js";
import { findGuildCommandDuplicates, getCommandDefinitions } from "./bot/command-registry.js";
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
  console.log("Registered " + body.length + " Avero global slash command(s): " + body.map((command) => "/" + command.name).join(", ") + ".");
  if (config.guildId) {
    const guildRoute = Routes.applicationGuildCommands(config.clientId, config.guildId);
    const guildCommands = await rest.get(guildRoute);
    const duplicates = findGuildCommandDuplicates(guildCommands, body);
    for (const command of duplicates) {
      await rest.delete(Routes.applicationGuildCommand(config.clientId, config.guildId, command.id));
    }
    if (duplicates.length) {
      console.log("Removed " + duplicates.length + " old server-specific duplicate command(s): " + duplicates.map((command) => "/" + command.name).join(", ") + ".");
    } else {
      console.log("No server-specific duplicates found in DISCORD_GUILD_ID.");
    }
  } else {
    console.log("Set DISCORD_GUILD_ID in .env to clean old server-specific copies in your test server.");
  }
  console.log("Global commands can take time to appear after registration.");
} catch (error) {
  const status = Number(error?.status ?? error?.httpStatus ?? 0);
  const discordCode = String(error?.code ?? error?.rawError?.code ?? "");
  console.error("Slash-command registration failed.");
  if (status === 403 && discordCode === "50001") {
    console.error(
      "Discord returned 403 Missing Access. Global registration does not require a guild ID. " +
      "Verify that DISCORD_TOKEN and DISCORD_CLIENT_ID belong to the same Discord application, " +
      "that the application is active, and that Avero is installed with the applications.commands " +
      "scope in the server where you are testing. Do not paste or commit your token."
    );
  } else if (status === 401) {
    console.error(
      "Discord rejected the bot token (401). Check DISCORD_TOKEN in your local environment; " +
      "make sure it is the bot token for DISCORD_CLIENT_ID."
    );
  } else {
    console.error("Discord API status:", status || "unknown", "code:", discordCode || "unknown");
    console.error(error?.message ?? "Unknown registration error.");
  }
  process.exitCode = 1;
}
