import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, ContainerBuilder, Events, GatewayIntentBits, MessageFlags, TextDisplayBuilder } from "discord.js";
import { createEmbed, ICONS, THEME } from "../averoui/index.js";
import { createCommandMap } from "./bot/command-registry.js";
import { commands } from "./bot/commands/index.js";
import { loadBotConfig } from "./bot/config.js";
import { getPrismaClient, disconnectPrismaClient } from "./db/client.js";
import { handleGameComponent } from "./bot/game-ui.js";
import { getGuildSettings } from "./db/guild-settings-repository.js";
import { handleConfigButton, handleConfigModal, handleConfigSelect, AVERO_SUPPORT_URL } from "./bot/commands/config.js";
import { handleMoneyRequestButton } from "./bot/ask-ui.js";
import { handleAutoReactionMessage } from "./bot/auto-reactions.js";
import { handleAutoResponseMessage } from "./bot/autoresponder/engine.js";
import { handleMemberMessageMilestone } from "./bot/autoresponder/milestones.js";
import { recordMessageActivity, handleVoiceStateUpdate, startActivityRuntime } from "./bot/activity-leaderboards.js";
import { handleProfileBioModal } from "./bot/commands/profile.js";
import { handleAveroPrefixMessage } from "./bot/prefix-router.js";
import { handleReputationPrefix, handleReputationComponent, handleReputationModal } from "./bot/commands/reputation.js";

let config;
try {
  config = loadBotConfig();
} catch (error) {
  console.error("Discord bot configuration error: " + error.message);
  process.exit(1);
}

const commandMap = createCommandMap(commands);
const gameCommandNames = new Set(["games", "coinflip", "guess", "rps", "vault"]);
const currencyCommandNames = new Set(["ask", "balance", "daily", "work", "scavenge", "shop", "buy", "inventory", "contracts", "perks"]);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});

client.once(Events.ClientReady, (readyClient) => {
  readyClient.user.setPresence({
    activities: [{
      name: "Avero",
      type: 0,
      state: "iℏ ∂ψ/∂t = Ĥψ"
    }],
    status: "online"
  });
  console.log("Avero Discord bot connected as " + readyClient.user.tag);
  startActivityRuntime(readyClient, getPrismaClient());
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.guildId || message.author.bot || message.webhookId) return;

  try {
    await recordMessageActivity(message, getPrismaClient());
  } catch (error) {
    console.error("Activity message tracking failed:", error);
  }

  try {
    await handleAutoReactionMessage(message, getPrismaClient());
  } catch (error) {
    console.error("Auto-reaction message handler failed:", error);
  }

  try {
    await handleAutoResponseMessage(message, getPrismaClient());
  } catch (error) {
    console.error("Autoresponder message handler failed:", error);
  }

  try {
    await handleMemberMessageMilestone(message, getPrismaClient());
  } catch (error) {
    console.error("Message milestone handler failed:", error);
  }

  if (client.user && message.mentions.users.has(client.user.id)) {
    const intro = new ContainerBuilder().setAccentColor(0x3A3D45);
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

client.on(Events.MessageCreate, async (message) => {
  try {
    if (await handleReputationPrefix(message, getPrismaClient())) return;
    await handleAveroPrefixMessage(message, commands);
  } catch (error) {
    console.error("Avero prefix router failed:", error);
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    await handleVoiceStateUpdate(getPrismaClient(), oldState, newState);
  } catch (error) {
    console.error("Activity voice tracking failed:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId.startsWith("avero-rep|")) {
    try {
      await handleReputationComponent(interaction, getPrismaClient());
    } catch (error) {
      console.error("Reputation component failed:", error);
      const payload = { content: "Avero couldn't process that reputation action. Please try again.", flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
    return;
  }
  if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isRoleSelectMenu()) {
    if (interaction.isButton() && interaction.customId.startsWith("avero-ask|")) {
      try {
        await handleMoneyRequestButton(interaction, getPrismaClient());
      } catch (error) {
        console.error("Money request response failed:", error);
        await interaction.reply({ content: "Avero could not process that request. Please try again.", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return;
    }
    if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isRoleSelectMenu()) &&
        interaction.customId.startsWith("avero-config-select|")) {
      try {
        await handleConfigSelect(interaction, getPrismaClient());
      } catch (error) {
        console.error("Reaction perk selection failed (guild: " + interaction.guildId + "):", error);
        const payload = { content: "Avero couldn't save that reaction perk. Please try again.", flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
        else await interaction.reply(payload).catch(() => {});
      }
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith("avero-config|")) {
      try {
        await handleConfigButton(interaction, getPrismaClient());
      } catch (error) {
        console.error("Config button failed (action: " + interaction.customId.split("|")[1] + ", guild: " + interaction.guildId + "):", error);
        const payload = {
          content: "Avero couldn't open that settings page. Please try again. If it keeps happening, ask an admin to check the bot logs.",
          flags: MessageFlags.Ephemeral
        };
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
      const currencyActions = new Set(["balance", "daily", "work", "scavenge", "shop", "shop_page", "shop_category", "buy", "inventory", "collections", "collections_page", "work_page", "collection_page", "collection_first", "collection_prev", "collection_next", "collection_last", "item", "equip_badge", "unequip_badge", "equip_frame", "unequip_frame", "equip_avatar_decoration", "unequip_avatar_decoration", "profile_accent", "profile_banner", "profile_avatar", "profile_frame", "profile_badges", "profile_bio", "profile_accent_select", "profile_banner_select", "profile_style_select", "profile_title_select", "profile_badges_select"]);
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
  if (interaction.isModalSubmit() && interaction.customId.startsWith("avero-rep|")) {
    try {
      await handleReputationModal(interaction, getPrismaClient());
    } catch (error) {
      console.error("Reputation modal failed:", error);
      const payload = { content: error instanceof RangeError || error instanceof TypeError ? error.message : "Avero couldn't save that reputation vote.", flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith("avero-profile-bio|")) {
    try {
      if (!interaction.guildId) {
        await interaction.reply({ content: "Profile customization is available inside a server.", flags: MessageFlags.Ephemeral });
        return;
      }
      await handleProfileBioModal(interaction, getPrismaClient());
    } catch (error) {
      console.error("Profile bio update failed:", error);
      const payload = { content: "Avero couldn't save your profile bio. Please try again.", flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith("avero-config-modal|")) {
    try {
      await handleConfigModal(interaction, getPrismaClient());
    } catch (error) {
      const message = error instanceof TypeError || error instanceof RangeError ? error.message : "Settings could not be saved. Check the values and try again.";
      const payload = { content: message, flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
    return;
  }
  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);
    if (typeof command?.autocomplete !== "function") return;
    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error("Command autocomplete failed (" + interaction.commandName + "):", error);
      await interaction.respond([]).catch(() => {});
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
    // Database-backed commands receive a shared Prisma client; API-only rank lookup does not need one.
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
