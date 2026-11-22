import { PermissionFlagsBits } from "discord.js";
import { getAutoReactionSettings, getAutoReactionRolePerks } from "../db/auto-reaction-repository.js";

const warnedPermissions = new Set();
const CUSTOM_EMOJI_PATTERN = /^<(a?):([a-zA-Z0-9_]{2,32}):(\d{17,20})>$/u;
const UNICODE_EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;
const EMOJI_SHORTCODES = Object.freeze({
  rainbow_flag: "🏳️‍🌈", trans_flag: "🏳️‍⚧️", heart: "❤️", white_heart: "🤍",
  black_heart: "🖤", purple_heart: "💜", red_heart: "❤️", fire: "🔥",
  star: "⭐", sparkles: "✨", tada: "🎉", party_popper: "🎉",
  rocket: "🚀", eyes: "👀", joy: "😂", sob: "😭", skull: "💀",
  thumbs_up: "👍", warning: "⚠️", check: "✔️", wave: "👋",
  thinking: "🤔", salute: "🫡", handshake: "🤝"
});

export function normalizeReactionEmoji(input) {
  if (typeof input !== "string") throw new TypeError("Choose an emoji.");
  const value = input.trim();
  if (!value || value.length > 100 || /\s/u.test(value)) {
    throw new TypeError("Enter one emoji, not a word or multiple emojis.");
  }
  const custom = value.match(CUSTOM_EMOJI_PATTERN);
  if (custom) return { kind: "custom", id: custom[3], value };
  const shortcode = value.match(/^:([a-zA-Z0-9_+-]+):$/u);
  if (shortcode) {
    const normalized = EMOJI_SHORTCODES[shortcode[1].toLowerCase()];
    if (!normalized) throw new TypeError("That emoji shortcode is not recognized. Try :rainbow_flag:, :heart: or :fire:.");
    return { kind: "unicode", value: normalized };
  }
  if (/[<>:]/u.test(value) || !UNICODE_EMOJI_PATTERN.test(value)) {
    throw new TypeError("Enter a standard emoji or a custom emoji from this server.");
  }
  if ([...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].length !== 1) {
    throw new TypeError("Enter exactly one emoji.");
  }
  return { kind: "unicode", value };
}

export function resolveSharedCustomEmoji(client, emojiId) {
  if (!client?.guilds?.cache || typeof emojiId !== "string") return null;
  for (const guild of client.guilds.cache.values()) {
    const emoji = guild.emojis?.cache?.get(emojiId);
    if (emoji?.available) return emoji;
  }
  return null;
}

export async function handleAutoReactionMessage(message, prisma) {
  if (!message?.guildId || !message.guild || !message.author || message.author.bot ||
      message.webhookId || message.system || !message.channelId ||
      !message.mentions?.users?.size || typeof message.react !== "function") return false;

  const settings = await getAutoReactionSettings(prisma, message.guildId);
  if (!settings.enabled || settings.ignoredChannelIds.includes(message.channelId)) return false;

  const perks = await getAutoReactionRolePerks(prisma, message.guildId);
  const memberRoles = message.member?.roles?.cache;
  const hasRole = (roleId) => Boolean(roleId && memberRoles?.has?.(roleId));
  const emojis = [...new Set(perks
    .filter((perk) => (perk.roleId && hasRole(perk.roleId)) || (perk.userId && perk.userId === message.author.id))
    .map((perk) => perk.emoji))];
  if (!emojis.length) return false;

  if (!message.reactions?.cache || typeof message.channel?.permissionsFor !== "function") return false;
  const botMember = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
  const permissions = botMember ? message.channel.permissionsFor(botMember) : null;
  if (!permissions?.has(PermissionFlagsBits.AddReactions)) {
    const warningKey = message.guildId + ":" + message.channelId;
    if (!warnedPermissions.has(warningKey)) {
      warnedPermissions.add(warningKey);
      console.warn("Reaction perks skipped: Avero needs Add Reactions in channel " + warningKey + ".");
    }
    return false;
  }

  let added = false;
  for (const emoji of emojis) {
    const customMatch = emoji.match(CUSTOM_EMOJI_PATTERN);
    const isExternalCustomEmoji = customMatch && !message.guild.emojis?.cache?.has(customMatch[3]);
    if (isExternalCustomEmoji && !permissions.has(PermissionFlagsBits.UseExternalEmojis)) {
      const warningKey = message.guildId + ":" + message.channelId + ":external-emoji";
      if (!warnedPermissions.has(warningKey)) {
        warnedPermissions.add(warningKey);
        console.warn("Reaction perks skipped for external custom emojis: Avero needs Use External Emojis in channel " + warningKey + ".");
      }
      continue;
    }
    if (message.reactions.cache.some((reaction) =>
      reaction.me && reaction.emoji.toString() === emoji
    )) continue;
    try {
      await message.react(emoji);
      added = true;
    } catch (error) {
      const code = Number(error?.code);
      if (code === 10014) {
        console.warn("Skipping unavailable role reaction emoji in guild " + message.guildId + ".");
        continue;
      }
      if (code === 10008 || code === 50013 || code === 50001) continue;
      console.error("Reaction perk failed in guild " + message.guildId + ":", error);
    }
  }
  return added;
}
