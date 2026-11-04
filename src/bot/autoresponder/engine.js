import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { listAutoResponseRules, createAutoResponseLog } from "../../db/autoresponder-repository.js";
const MAX_CONTENT_LENGTH = 2000;
const MAX_MATCH_INPUT = 4000;
const COOLDOWN_SCOPE_GLOBAL = "__global__";
const warnedPermissions = new Set();

export function normalizeTriggerText(value, caseSensitive = false) {
  const text = String(value ?? "").normalize("NFKC").trim();
  return caseSensitive ? text : text.toLocaleLowerCase("en-US");
}
export function matchesAutoResponseRule(rule, message, botUserId) {
  const content = String(message.content ?? "").slice(0, MAX_MATCH_INPUT);
  const haystack = normalizeTriggerText(content, rule.caseSensitive);
  const needle = normalizeTriggerText(rule.trigger ?? "", rule.caseSensitive);
  switch (rule.matchType) {
    case "exact": return Boolean(needle) && haystack === needle;
    case "contains": return Boolean(needle) && haystack.includes(needle);
    case "starts_with": return Boolean(needle) && haystack.startsWith(needle);
    case "ends_with": return Boolean(needle) && haystack.endsWith(needle);
    case "attachment": return Boolean(message.attachments?.size);
    case "user_mention": return Boolean(message.mentions?.users?.size);
    case "bot_mention": return Boolean(botUserId && message.mentions?.users?.has(botUserId));
    default: return false;
  }
}
function memberHasAny(member, roleIds) {
  if (!roleIds?.length) return true;
  const roles = member?.roles?.cache;
  return Boolean(roles && roleIds.some((id) => roles.has(id)));
}
function isAllowed(rule, message) {
  if (rule.allowedChannelIds.length && !rule.allowedChannelIds.includes(message.channelId)) return false;
  if (rule.ignoredChannelIds.includes(message.channelId)) return false;
  if (!memberHasAny(message.member, rule.allowedRoleIds)) return false;
  const roles = message.member?.roles?.cache;
  if (roles && rule.ignoredRoleIds.some((id) => roles.has(id))) return false;
  return true;
}
function chooseResponse(rule) {
  if (rule.responseType === "random") {
    const options = Array.isArray(rule.randomResponses) ? rule.randomResponses.filter(Boolean).slice(0, 10) : [];
    if (options.length) return options[Math.floor(Math.random() * options.length)];
  }
  return rule.responseContent;
}
export function renderAutoResponseTemplate(template, message) {
  const replacements = {
    user: message.author.toString(), username: message.author.username ?? message.author.globalName ?? "member",
    user_id: message.author.id, server: message.guild?.name ?? "this server", server_id: message.guildId,
    channel: message.channel?.name ?? "this channel", member_count: String(message.guild?.memberCount ?? "unknown"),
    mention: message.author.toString(), bot: message.client?.user?.username ?? "Avero"
  };
  return String(template ?? "").replace(/\{(user|username|user_id|server|server_id|channel|member_count|mention|bot)\}/g, (_, key) => replacements[key]).slice(0, MAX_CONTENT_LENGTH);
}
async function claimRuleCooldowns(prisma, rule, userId) {
  const scopes = [];
  if (rule.cooldownSeconds > 0) scopes.push({ scopeKey: COOLDOWN_SCOPE_GLOBAL, seconds: rule.cooldownSeconds });
  if (rule.perUserCooldownSeconds > 0) scopes.push({ scopeKey: userId, seconds: rule.perUserCooldownSeconds });
  if (!scopes.length) return true;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const keys = scopes.map((scope) => scope.scopeKey);
        const existing = await tx.autoResponseCooldown.findMany({
          where: { ruleId: rule.id, scopeKey: { in: keys } }
        });
        const byKey = new Map(existing.map((entry) => [entry.scopeKey, entry]));
        const nowMs = Date.now();
        for (const scope of scopes) {
          const row = byKey.get(scope.scopeKey);
          if (row && row.lastTriggeredAt.getTime() > nowMs - scope.seconds * 1000) return false;
        }
        const now = new Date();
        for (const scope of scopes) {
          await tx.autoResponseCooldown.upsert({
            where: { ruleId_scopeKey: { ruleId: rule.id, scopeKey: scope.scopeKey } },
            create: { ruleId: rule.id, scopeKey: scope.scopeKey, lastTriggeredAt: now },
            update: { lastTriggeredAt: now }
          });
        }
        return true;
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error?.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  return false;
}
async function sendResponse(rule, message) {
  const rendered = renderAutoResponseTemplate(chooseResponse(rule), message);
  const allowedMentions = { parse: [], users: [message.author.id], roles: [], repliedUser: false };
  let sent;
  if (rule.responseType === "dm") sent = await message.author.send({ content: rendered, allowedMentions });
  else if (rule.responseType === "embed") sent = await message.channel.send({ embeds: [new EmbedBuilder().setDescription(rendered)], allowedMentions });
  else if (rule.responseType === "reply") sent = await message.reply({ content: rendered, allowedMentions });
  else sent = await message.channel.send({ content: rendered, allowedMentions });
  if (sent && rule.deleteAfterSeconds > 0) {
    const delay = Math.min(rule.deleteAfterSeconds, 86400) * 1000;
    const timer = setTimeout(() => sent.delete().catch(() => {}), delay);
    timer.unref?.();
  }
}
export async function handleAutoResponseMessage(message, prisma) {
  if (!message?.guildId || !message.guild || !message.author || message.author.bot ||
      message.webhookId || message.system || !message.channelId || !message.channel ||
      typeof message.channel.send !== "function") return 0;
  const rules = await listAutoResponseRules(prisma, message.guildId);
  if (!rules.length) return 0;
  const botMember = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
  const permissions = botMember && typeof message.channel.permissionsFor === "function"
    ? message.channel.permissionsFor(botMember) : null;
  if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
    const key = message.guildId + ":" + message.channelId;
    if (!warnedPermissions.has(key)) {
      warnedPermissions.add(key);
      console.warn("Autoresponder skipped: Avero needs Send Messages in channel " + key + ".");
    }
    return 0;
  }
  let sentCount = 0;
  for (const rule of rules) {
    if (!rule.enabled || !isAllowed(rule, message) || !matchesAutoResponseRule(rule, message, message.client?.user?.id)) continue;
    if (rule.responseType === "embed" && !permissions.has(PermissionFlagsBits.EmbedLinks)) continue;
    if (!await claimRuleCooldowns(prisma, rule, message.author.id)) continue;
    try {
      await sendResponse(rule, message);
      sentCount += 1;
      await createAutoResponseLog(prisma, { guildId: message.guildId, ruleId: rule.id, userId: message.author.id, channelId: message.channelId, status: "sent" })
        .catch((error) => console.error("Autoresponder success log failed:", error?.message ?? error));
    } catch (error) {
      await createAutoResponseLog(prisma, { guildId: message.guildId, ruleId: rule.id, userId: message.author.id, channelId: message.channelId, status: "failed" })
        .catch((logError) => console.error("Autoresponder failure log failed:", logError?.message ?? logError));
      const code = Number(error?.code);
      if (![50007, 50013, 50001, 10003, 10008].includes(code)) console.error("Autoresponder rule " + rule.id + " failed in guild " + message.guildId + ":", error);
    }
    if (rule.stopOnMatch) break;
  }
  return sentCount;
}
