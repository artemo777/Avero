import { REST, Routes } from "discord.js";
import { commands } from "./bot/commands/index.js";
import { getCommandDefinitions } from "./bot/command-registry.js";
import { loadBotConfig, requireApplicationId } from "./bot/config.js";

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
  console.log(
    "Registered " + body.length + " Avero global slash command(s): " +
    body.map((command) => "/" + command.name).join(", ") + "."
  );
  console.log("The global application command set was replaced. Global updates can take time to appear.");
} catch (error) {
  const status = Number(error?.status ?? error?.httpStatus ?? 0);
  const discordCode = String(error?.code ?? error?.rawError?.code ?? "");
  console.error("Global slash-command registration failed.");
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
