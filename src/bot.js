import { Client, Events, GatewayIntentBits } from "discord.js";
import { createEmbed, ICONS, THEME } from "../averoui/index.js";
import { createCommandMap } from "./bot/command-registry.js";
import { commands } from "./bot/commands/index.js";
import { loadBotConfig } from "./bot/config.js";
import { grantLevelRoleRewards, MESSAGE_XP_COOLDOWN_MS, randomMessageExperience } from "./bot/leveling.js";
import { getPrismaClient, disconnectPrismaClient } from "./db/client.js";
import { recordMessageExperience } from "./db/member-repository.js";

let config;
try {
  config = loadBotConfig();
} catch (error) {
  console.error("Discord bot configuration error: " + error.message);
  process.exit(1);
}

const commandMap = createCommandMap(commands);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log("Avero Discord bot connected as " + readyClient.user.tag);
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.guildId || message.author.bot || !message.member) return;

  try {
    const prisma = getPrismaClient();
    const result = await recordMessageExperience(prisma, message.guildId, message.author.id, {
      amount: randomMessageExperience(),
      cooldownMs: MESSAGE_XP_COOLDOWN_MS
    });
    if (!result.awarded) return;

    if (result.profile.level > result.previousLevel) {
      const grantedLevels = await grantLevelRoleRewards(
        message.member,
        result.previousLevel,
        result.profile.level,
        config.levelRoleRewards
      );
      const rewardText = grantedLevels.length
        ? " Reward role(s) granted for level " + grantedLevels.join(", ") + "."
        : "";
      await message.channel.send({
        content: ICONS.success + " " + message.author + " reached level " + result.profile.level + "!" + rewardText,
        allowedMentions: { users: [message.author.id] }
      }).catch((error) => console.error("Level-up announcement failed:", error));
    }
  } catch (error) {
    console.error("Message XP processing failed:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  try {
    const prisma = interaction.commandName === "rank" ? getPrismaClient() : undefined;
    await command.execute(interaction, { prisma });
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
