import { MessageFlags } from "discord.js";
import { getPrismaClient } from "../db/client.js";
import { getGuildSettings } from "../db/guild-settings-repository.js";
import { answerAveroQuestion } from "./ai.js";

const GAME_COMMANDS = new Set(["games", "coinflip", "guess", "rps", "vault"]);
const CURRENCY_COMMANDS = new Set(["ask", "balance", "daily", "work", "scavenge", "shop", "buy", "inventory", "contracts", "perks"]);

export function tokenizePrefixArguments(input) {
  const tokens = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(String(input ?? ""))) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

function optionValue(option, raw, message) {
  if (raw === undefined) return null;
  switch (option.type) {
    case 4: {
      const value = Number.parseInt(raw, 10);
      return Number.isSafeInteger(value) ? value : null;
    }
    case 10: {
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    }
    case 5:
      if (/^(true|yes|on)$/i.test(raw)) return true;
      if (/^(false|no|off)$/i.test(raw)) return false;
      return null;
    case 6:
    case 7:
    case 8:
    case 9: {
      const id = raw.match(/^<?[@#&]!?([0-9]{15,22})>?$/)?.[1] ?? raw;
      if (!/^[0-9]{15,22}$/.test(id)) return null;
      if (option.type === 6) return message.guild.members.cache.get(id)?.user ?? null;
      if (option.type === 7) return message.guild.channels.cache.get(id) ?? null;
      if (option.type === 8) return message.guild.roles.cache.get(id) ?? null;
      return message.guild.members.cache.get(id)?.roles?.cache?.first() ?? null;
    }
    default:
      return raw;
  }
}

function buildOptions(definitions, tokens, message, subcommand, group) {
  const values = new Map();
  definitions.forEach((definition, index) => {
    values.set(definition.name, optionValue(definition, tokens[index], message));
  });
  const get = (name) => values.get(name) ?? null;
  return {
    getString: (name) => get(name),
    getInteger: (name) => get(name),
    getNumber: (name) => get(name),
    getBoolean: (name) => get(name),
    getUser: (name) => get(name),
    getMember: (name) => {
      const user = get(name);
      return user ? message.guild.members.cache.get(user.id) ?? null : null;
    },
    getRole: (name) => get(name),
    getChannel: (name) => get(name),
    getMentionable: (name) => get(name),
    getAttachment: (name) => name === definitions.find((item) => item.name === name)?.name ? message.attachments.first() ?? null : null,
    getSubcommand: (required = true) => {
      if (!subcommand && required) throw new Error("A subcommand is required.");
      return subcommand ?? null;
    },
    getSubcommandGroup: (required = true) => {
      if (!group && required) throw new Error("A subcommand group is required.");
      return group ?? null;
    },
    getFocused: () => null,
    data: [...values].map(([name, value]) => ({ name, value }))
  };
}

function parseCommandArguments(command, input, message) {
  const tokens = [...input];
  const definitions = command.data.options ?? [];
  let subcommand = null;
  let group = null;
  let activeDefinitions = definitions;

  const first = definitions[0];
  if (first && (first.type === 1 || first.type === 2)) {
    const selected = definitions.find((entry) => entry.name === tokens[0]);
    if (!selected) throw new Error("Choose a valid subcommand: " + definitions.map((entry) => entry.name).join(", ") + ".");
    tokens.shift();
    if (selected.type === 2) {
      group = selected.name;
      const nestedName = tokens.shift();
      const nested = (selected.options ?? []).find((entry) => entry.name === nestedName && entry.type === 1);
      if (!nested) throw new Error("Choose a subcommand in " + group + ": " + (selected.options ?? []).map((entry) => entry.name).join(", ") + ".");
      subcommand = nested.name;
      activeDefinitions = nested.options ?? [];
    } else {
      subcommand = selected.name;
      activeDefinitions = selected.options ?? [];
    }
  }

  const missing = activeDefinitions.find((option, index) => option.required && tokens[index] === undefined);
  if (missing) throw new Error("Missing required argument: " + missing.name + ". Use `/" + command.data.name + "` in Discord to see its options.");
  const options = buildOptions(activeDefinitions, tokens, message, subcommand, group);
  return { options, subcommand, group };
}

function prefixInteraction(message, options) {
  let responseMessage = null;
  const interaction = {
    id: message.id,
    token: "",
    applicationId: message.client.user.id,
    guildId: message.guildId,
    channelId: message.channelId,
    guild: message.guild,
    channel: message.channel,
    client: message.client,
    user: message.author,
    member: message.member,
    memberPermissions: message.member?.permissions ?? null,
    createdTimestamp: message.createdTimestamp,
    options,
    replied: false,
    deferred: false,
    async reply(payload) {
      const normalized = typeof payload === "string" ? { content: payload } : { ...payload };
      if (typeof normalized.flags === "number") {
        normalized.flags &= ~MessageFlags.Ephemeral;
        if (normalized.flags === 0) delete normalized.flags;
      }
      normalized.allowedMentions ??= { parse: [], repliedUser: false };
      responseMessage = await message.reply(normalized);
      this.replied = true;
      return responseMessage;
    },
    async deferReply() {
      this.deferred = true;
      await message.channel.sendTyping().catch(() => {});
    },
    async editReply(payload) {
      if (responseMessage) return responseMessage.edit(payload);
      responseMessage = await message.reply(payload);
      this.replied = true;
      return responseMessage;
    },
    async followUp(payload) {
      const normalized = typeof payload === "string" ? { content: payload } : { ...payload };
      if (typeof normalized.flags === "number") {
        normalized.flags &= ~MessageFlags.Ephemeral;
        if (normalized.flags === 0) delete normalized.flags;
      }
      normalized.allowedMentions ??= { parse: [], repliedUser: false };
      return message.reply(normalized);
    },
    async fetchReply() {
      return responseMessage;
    },
    async deleteReply() {
      if (responseMessage) await responseMessage.delete();
    }
  };
  return interaction;
}

export async function handleAveroPrefixMessage(message, commands) {
  if (!message.guildId || message.author.bot || message.webhookId) return false;
  const content = String(message.content ?? "").trim();
  const match = content.match(/^avero(?:\s+([\s\S]*))?$/i);
  if (!match) return false;

  const input = tokenizePrefixArguments(match[1] ?? "");
  const commandName = input.shift()?.toLowerCase();
  const command = commandName ? commands.find((entry) => entry.data.name === commandName) : null;

  if (command) {
    try {
      const parsed = parseCommandArguments(command, input, message);
      const interaction = prefixInteraction(message, parsed.options);
      const needsDatabase = !["ping", "help", "rank"].includes(command.data.name);
      const prisma = needsDatabase ? getPrismaClient() : undefined;
      const settings = needsDatabase ? await getGuildSettings(prisma, message.guildId) : undefined;
      if (GAME_COMMANDS.has(command.data.name) && !settings.gamesEnabled) {
        await interaction.reply({ content: "Games are paused by this server's admins." });
        return true;
      }
      if (CURRENCY_COMMANDS.has(command.data.name) && !settings.currencyEnabled) {
        await interaction.reply({ content: "Currency is paused by this server's admins." });
        return true;
      }
      await command.execute(interaction, { prisma, settings });
      return true;
    } catch (error) {
      const text = error instanceof TypeError || error instanceof RangeError
        ? error.message
        : (error?.message?.includes("required argument") || error?.message?.startsWith("Choose a valid"))
          ? error.message
          : "I couldn't run that command. Try `avero help` or use its slash-command version for interactive options.";
      await message.reply({ content: text, allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
      return true;
    }
  }

  try {
    const answer = await answerAveroQuestion({ message, commands });
    await message.reply({ content: answer.slice(0, 1900), allowedMentions: { parse: [], repliedUser: false } });
  } catch (error) {
    console.error("Avero AI assistant failed:", error);
    await message.reply({
      content: "I couldn't answer that right now. Try `avero help` to see available commands.",
      allowedMentions: { parse: [], repliedUser: false }
    }).catch(() => {});
  }
  return true;
}
