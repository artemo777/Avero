import { Client, Events, GatewayIntentBits } from "discord.js";
import { createEmbed, ICONS, THEME } from "../averoui/index.js";
import { createCommandMap } from "./bot/command-registry.js";
import { commands } from "./bot/commands/index.js";
import { loadBotConfig } from "./bot/config.js";

let config;
try {
  config = loadBotConfig();
} catch (error) {
  console.error("Discord bot configuration error: " + error.message);
  process.exit(1);
}

const commandMap = createCommandMap(commands);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log("Avero Discord bot connected as " + readyClient.user.tag);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error("Command execution failed (" + interaction.commandName + "):", error);
    const payload = {
      embeds: [
        createEmbed({
          title: ICONS.error + " Command failed",
          description: "Avero could not complete that command. Please try again later.",
          color: THEME.colors.danger,
          footer: "AveroUI • Shared response style"
        })
      ],
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.on(Events.Error, (error) => {
  console.error("Discord client error:", error);
});

try {
  await client.login(config.token);
} catch (error) {
  console.error("Discord login failed. Check DISCORD_TOKEN and bot access.");
  process.exitCode = 1;
  await client.destroy();
}
