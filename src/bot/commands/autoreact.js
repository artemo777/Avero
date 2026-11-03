import { MessageFlags, PermissionFlagsBits } from "discord.js";
import {
  addIgnoredChannel, getAutoReactionSettings, removeIgnoredChannel, updateAutoReactionSettings
} from "../../db/auto-reaction-repository.js";

const CUSTOM_EMOJI_PATTERN = /^<(a?):([a-zA-Z0-9_]{2,32}):(\d{17,20})>$/u;
const UNICODE_EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

export function normalizeAutoReactionEmoji(input) {
  if (typeof input !== "string") throw new TypeError("Choose an emoji.");
  const value = input.trim();
  if (!value || value.length > 100 || /\s/u.test(value)) throw new TypeError("Enter one emoji, not a word or multiple emojis.");
  if ([...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].length !== 1) {
    throw new TypeError("Enter exactly one emoji.");
  }
  const custom = value.match(CUSTOM_EMOJI_PATTERN);
  if (custom) return { kind: "custom", id: custom[3], value };
  if (/[<>:]/u.test(value) || !UNICODE_EMOJI_PATTERN.test(value)) {
    throw new TypeError("Enter a standard emoji or a custom emoji from this server.");
  }
  return { kind: "unicode", value };
}

async function getActorAccess(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return { admin: false, booster: false };
  return {
    admin: member.permissions.has(PermissionFlagsBits.Administrator),
    booster: Boolean(member.premiumSince)
  };
}
async function validateEmojiForGuild(interaction, input) {
  const parsed = normalizeAutoReactionEmoji(input);
  if (parsed.kind === "unicode") return parsed.value;
  const emoji = await interaction.guild.emojis.fetch(parsed.id).catch(() => null);
  if (!emoji || !emoji.available) throw new TypeError("That custom emoji is not available in this server. Choose an emoji shared in this server.");
  return emoji.toString();
}
const reply = (content) => ({ content, flags: MessageFlags.Ephemeral });

export const autoreactCommand = Object.freeze({
  data: Object.freeze({
    name: "autoreact",
    description: "Configure automatic reactions for this server.",
    options: [
      { type: 1, name: "enable", description: "Enable automatic reactions." },
      { type: 1, name: "disable", description: "Disable automatic reactions." },
      { type: 1, name: "set", description: "Set or change the automatic reaction emoji.", options: [
        { type: 3, name: "emoji", description: "A standard emoji or custom emoji from this server.", required: true, max_length: 100 }
      ]},
      { type: 1, name: "remove", description: "Remove the configured emoji and disable auto-reactions." },
      { type: 1, name: "status", description: "View this server's auto-reaction settings." },
      { type: 1, name: "ignore", description: "Exclude a channel (administrators only).", options: [
        { type: 7, name: "channel", description: "Channel where Avero should not react.", required: true, channel_types: [0, 5] }
      ]},
      { type: 1, name: "unignore", description: "Re-enable auto-reactions in a channel (administrators only).", options: [
        { type: 7, name: "channel", description: "Channel to remove from the ignore list.", required: true, channel_types: [0, 5] }
      ]}
    ]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Autoreact command requires a database client.");
    const action = interaction.options.getSubcommand();
    const access = await getActorAccess(interaction);
    const adminOnly = action === "ignore" || action === "unignore";
    const canConfigure = access.admin || access.booster;

    if (action === "status") {
      const settings = await getAutoReactionSettings(prisma, interaction.guildId);
      const ignored = settings.ignoredChannelIds.length ? settings.ignoredChannelIds.map((id) => "<#" + id + ">").join(", ") : "None";
      await interaction.reply(reply(
        "**Auto-reactions:** " + (settings.enabled && settings.emoji ? "Enabled" : "Disabled") +
        "\n**Emoji:** " + (settings.emoji || "Not configured") +
        "\n**Ignored channels:** " + ignored
      ));
      return;
    }

    if (adminOnly ? !access.admin : !canConfigure) {
      await interaction.reply(reply(adminOnly
        ? "Only server administrators can manage ignored channels."
        : "Only server administrators and current server boosters can configure auto-reactions."));
      return;
    }

    if (action === "enable") {
      const settings = await getAutoReactionSettings(prisma, interaction.guildId);
      if (!settings.emoji) {
        await interaction.reply(reply("Set an emoji first with /autoreact set, then run /autoreact enable."));
        return;
      }
      await updateAutoReactionSettings(prisma, interaction.guildId, { enabled: true });
      await interaction.reply(reply("✓ Auto-reactions are now enabled. Avero will react to new messages in this server, except ignored channels."));
      return;
    }
    if (action === "disable") {
      await updateAutoReactionSettings(prisma, interaction.guildId, { enabled: false });
      await interaction.reply(reply("Auto-reactions have been disabled for this server."));
      return;
    }
    if (action === "set") {
      const input = interaction.options.getString("emoji", true);
      const emoji = await validateEmojiForGuild(interaction, input);
      const settings = await updateAutoReactionSettings(prisma, interaction.guildId, { emoji });
      await interaction.reply(reply("✓ Auto-reaction emoji updated to " + emoji + ". " +
        (settings.enabled ? "New messages will use the updated emoji." : "Run /autoreact enable when you're ready to turn it on.")));
      return;
    }
    if (action === "remove") {
      await updateAutoReactionSettings(prisma, interaction.guildId, { emoji: null, enabled: false });
      await interaction.reply(reply("The auto-reaction emoji has been removed and auto-reactions are disabled."));
      return;
    }
    if (action === "ignore") {
      const channel = interaction.options.getChannel("channel", true);
      await addIgnoredChannel(prisma, interaction.guildId, channel.id);
      await interaction.reply(reply("✓ " + channel.toString() + " is now excluded from auto-reactions."));
      return;
    }
    if (action === "unignore") {
      const channel = interaction.options.getChannel("channel", true);
      const before = await getAutoReactionSettings(prisma, interaction.guildId);
      if (!before.ignoredChannelIds.includes(channel.id)) {
        await interaction.reply(reply(channel.toString() + " is not currently ignored."));
        return;
      }
      await removeIgnoredChannel(prisma, interaction.guildId, channel.id);
      await interaction.reply(reply("✓ Auto-reactions are enabled again in " + channel.toString() + "."));
    }
  }
});
