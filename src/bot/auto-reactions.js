import { PermissionFlagsBits } from "discord.js";
import { getAutoReactionSettings, updateAutoReactionSettings } from "../db/auto-reaction-repository.js";

const warnedPermissions = new Set();

export async function handleAutoReactionMessage(message, prisma) {
  if (!message?.guildId || !message.guild || !message.author || message.author.bot ||
      message.webhookId || message.system || !message.channelId) return false;

  const settings = await getAutoReactionSettings(prisma, message.guildId);
  if (!settings.enabled || !settings.emoji || settings.ignoredChannelIds.includes(message.channelId)) return false;

  if (!message.reactions?.cache || typeof message.react !== "function" || typeof message.channel?.permissionsFor !== "function") return false;
  if (message.reactions.cache.some((reaction) => reaction.me && reaction.emoji.toString() === settings.emoji)) return false;

  const botMember = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
  const permissions = botMember ? message.channel.permissionsFor(botMember) : null;
  if (!permissions?.has(PermissionFlagsBits.AddReactions)) {
    const warningKey = message.guildId + ":" + message.channelId;
    if (!warnedPermissions.has(warningKey)) {
      warnedPermissions.add(warningKey);
      console.warn("Auto-reaction skipped: Avero needs Add Reactions in channel " + warningKey + ".");
    }
    return false;
  }

  try {
    await message.react(settings.emoji);
    return true;
  } catch (error) {
    const code = Number(error?.code);
    if (code === 10014) {
      await updateAutoReactionSettings(prisma, message.guildId, { enabled: false }).catch((dbError) => {
        console.error("Could not disable auto-reactions after an invalid emoji:", dbError);
      });
      console.warn("Auto-reactions disabled in guild " + message.guildId + ": the configured emoji is unavailable.");
      return false;
    }
    if (code === 10008 || code === 50013 || code === 50001) return false;
    console.error("Auto-reaction failed in guild " + message.guildId + ":", error);
    return false;
  }
}
