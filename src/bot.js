import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, ContainerBuilder, Events, GatewayIntentBits, MessageFlags, TextDisplayBuilder } from "discord.js";
import { createEmbed, ICONS, THEME } from "../averoui/index.js";
import { createCommandMap } from "./bot/command-registry.js";
import { commands } from "./bot/commands/index.js";
import { loadBotConfig } from "./bot/config.js";
import { getPrismaClient, disconnectPrismaClient } from "./db/client.js";
import { handleGameComponent } from "./bot/game-ui.js";
import { getGuildSettings } from "./db/guild-settings-repository.js";
import { handleConfigButton, handleConfigModal, AVERO_SUPPORT_URL } from "./bot/commands/config.js";

let config;
try {
  config = loadBotConfig();
} catch (error) {
  console.error("Discord bot configuration error: " + error.message);
  process.exit(1);
}

const commandMap = createCommandMap(commands);
const gameCommandNames = new Set(["games", "coinflip", "guess", "rps", "vault"]);
const currencyCommandNames = new Set(["balance", "daily", "work", "scavenge", "shop", "buy", "inventory", "contracts", "perks"]);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log("Avero Discord bot connected as " + readyClient.user.tag);
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.guildId || message.author.bot || !message.member) return;

  if (client.user && message.mentions.users.has(client.user.id)) {
    const intro = new ContainerBuilder().setAccentColor(THEME.colors.primary);
    intro.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      "-# AVERO • SERVER ASSISTANT\n## Hey, I'm Avero.\nGames, coins, collectibles. The good stuff.\n-# Start with **/games**, **/daily** or **/shop**."
    ));
    intro.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Support").setStyle(ButtonStyle.Link).setURL(AVERO_SUPPORT_URL)
    ));
    await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [intro],
      allowedMentions: { parse: [] }
    }).catch((error) => console.error("Mention intro panel failed:", error));
  }

});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("avero-config|")) {
      try {
        await handleConfigButton(interaction, getPrismaClient());
      } catch (error) {
        const payload = { content: "Could not open settings. Check your permissions and try again.", flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
        else await interaction.reply(payload).catch(() => {});
      }
      return;
    }
    if (!interaction.customId.startsWith("avero|")) return;
    try {
      if (!interaction.guildId) {
        await interaction.reply({ content: "Avero games and currency are available inside a server.", flags: MessageFlags.Ephemeral });
        return;
      }
      const prisma = getPrismaClient();
      const settings = await getGuildSettings(prisma, interaction.guildId);
      const action = interaction.customId.split("|")[2];
      const gameActions = new Set(["games", "guess", "coinflip", "rps", "vault"]);
      const currencyActions = new Set(["balance", "daily", "work", "scavenge", "shop", "buy", "inventory", "collections", "collection_page", "item", "equip_badge", "unequip_badge"]);
      if (gameActions.has(action) && !settings.gamesEnabled) {
        await interaction.reply({ content: "Games are paused by this server's admins.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (currencyActions.has(action) && !settings.currencyEnabled) {
        await interaction.reply({ content: "Currency is paused by this server's admins.", flags: MessageFlags.Ephemeral });
        return;
      }
      await handleGameComponent(interaction, { prisma, settings });
    } catch (error) {
      console.error("Game component failed:", error);
      const payload = { content: "Avero could not complete that action. Please try again.", flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith("avero-config-modal|")) {
    try {
      await handleConfigModal(interaction, getPrismaClient());
    } catch (error) {
      const payload = { content: "Settings could not be saved. Check the values and try again.", flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  if (!interaction.guildId) {
    await interaction.reply({ content: "Avero commands can only be used inside a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    // Every command except the two database-free utilities receives a shared Prisma client.
    // Keep this explicit so newly added economy/profile commands cannot silently miss injection.
    const needsDatabase = !["ping", "help"].includes(interaction.commandName);
    const prisma = needsDatabase ? getPrismaClient() : undefined;
    const settings = needsDatabase ? await getGuildSettings(prisma, interaction.guildId) : undefined;
    if (gameCommandNames.has(interaction.commandName) && !settings.gamesEnabled) {
      await interaction.reply({ content: "Games are paused by this server's admins.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (currencyCommandNames.has(interaction.commandName) && !settings.currencyEnabled) {
      await interaction.reply({ content: "Currency is paused by this server's admins.", flags: MessageFlags.Ephemeral });
      return;
    }
    await command.execute(interaction, { prisma, settings });
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
      flags: MessageFlags.Ephemeral
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

const shutdown = async (signal) => {
  console.log("Avero received " + signal + "; shutting down.");
  client.destroy();
  await disconnectPrismaClient().catch((error) => console.error("Database disconnect failed:", error));
  process.exit(0);
};
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await client.login(config.token);
} catch (error) {
  console.error("Discord login failed. Check DISCORD_TOKEN and bot access.");
  process.exitCode = 1;
  await client.destroy();
  await disconnectPrismaClient().catch(() => {});
}
