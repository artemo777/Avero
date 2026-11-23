import { REST, Routes } from "discord.js";
import { commands } from "./bot/commands/index.js";
import { findGuildCommandDuplicates, getCommandDefinitions } from "./bot/command-registry.js";
import { loadBotConfig, requireApplicationId } from "./bot/config.js";
import { installConsoleLogger, log } from "./bot/logger.js";

installConsoleLogger();
log.system("Slash-command registration starting");

let config;
try {
  config = loadBotConfig();
  requireApplicationId(config);
} catch (error) {
  console.error("Global slash-command registration configuration error: " + error.message);
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(config.token);
const body = getCommandDefinitions(commands);

try {
  await rest.put(Routes.applicationCommands(config.clientId), { body });
  log.ok("Registered", body.length, "global slash commands");
  if (config.guildId) {
    const legacyGuildCommands = await rest.get(
      Routes.applicationGuildCommands(config.clientId, config.guildId)
    );
    const duplicates = findGuildCommandDuplicates(body, legacyGuildCommands);
    for (const command of duplicates) {
      await rest.delete(
        Routes.applicationGuildCommand(config.clientId, config.guildId, command.id)
      );
    }
    log.info("Removed", duplicates.length, "legacy guild-command duplicates");
  } else {
    log.info("Guild-scoped cleanup skipped (DISCORD_GUILD_ID unset)");
  }
  log.ok("Command registration complete; global propagation may take time");
} catch (error) {
  const status = Number(error?.status ?? error?.httpStatus ?? 0);
  const discordCode = String(error?.code ?? error?.rawError?.code ?? "");
  console.error("Global slash-command registration or legacy guild-command cleanup failed.");
  if (status === 403 && discordCode === "50001") {
    console.error(
      "Discord returned 403 Missing Access. Verify that DISCORD_TOKEN and DISCORD_CLIENT_ID belong " +
      "to the same Discord application and that the application is active. Do not paste or commit your token."
    );
  } else if (status === 401) {
    console.error("Discord rejected the bot token (401). Check the local DISCORD_TOKEN; do not paste it here.");
  } else {
    console.error("Discord API status:", status || "unknown", "code:", discordCode || "unknown");
    console.error(error?.message ?? "Unknown registration error.");
  }
  process.exitCode = 1;
}
