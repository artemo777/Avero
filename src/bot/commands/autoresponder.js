import { MessageFlags, PermissionFlagsBits } from "discord.js";
import {
  createAutoResponseRule, deleteAutoResponseRule, getAutoResponseStats, getAutoResponseLogs,
  listAutoResponseRules, updateAutoResponseRule
} from "../../db/autoresponder-repository.js";

const SNOWFLAKE = /^\d{17,20}$/;
const MATCH_TYPES = ["exact", "contains", "starts_with", "ends_with", "attachment", "user_mention", "bot_mention"];
const RESPONSE_TYPES = ["text", "embed", "reply", "random", "dm"];
const idList = (value, label) => {
  if (!value?.trim()) return [];
  const values = [...new Set(value.split(/[\s,]+/).filter(Boolean))];
  if (values.some((id) => !SNOWFLAKE.test(id))) throw new Error(label + " must contain valid Discord IDs separated by commas.");
  if (values.length > 50) throw new Error(label + " supports up to 50 IDs.");
  return values;
};
const isAdmin = (interaction) => Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });
const str = (i, name, required = false) => i.options.getString(name, required);
const int = (i, name) => i.options.getInteger(name, false);
const bool = (i, name) => i.options.getBoolean(name, false);

function readRuleOptions(interaction, partial = false) {
  const data = {};
  const name = str(interaction, "name");
  const trigger = str(interaction, "trigger");
  const response = str(interaction, "response");
  if (name !== null) data.name = name.trim();
  if (trigger !== null) data.trigger = trigger.trim();
  if (response !== null) data.responseContent = response.trim();
  const matchType = str(interaction, "match_type");
  const responseType = str(interaction, "response_type");
  if (matchType !== null) data.matchType = matchType;
  if (responseType !== null) data.responseType = responseType;
  for (const [option, field] of [["cooldown", "cooldownSeconds"], ["user_cooldown", "perUserCooldownSeconds"], ["priority", "priority"], ["delete_after", "deleteAfterSeconds"]]) {
    const value = int(interaction, option);
    if (value !== null) data[field] = value;
  }
  for (const [option, field] of [["allowed_channels", "allowedChannelIds"], ["ignored_channels", "ignoredChannelIds"], ["allowed_roles", "allowedRoleIds"], ["ignored_roles", "ignoredRoleIds"]]) {
    const value = str(interaction, option);
    if (value !== null) data[field] = idList(value, option.replaceAll("_", " "));
  }
  const caseSensitive = bool(interaction, "case_sensitive");
  const stopOnMatch = bool(interaction, "stop_on_match");
  if (caseSensitive !== null) data.caseSensitive = caseSensitive;
  if (stopOnMatch !== null) data.stopOnMatch = stopOnMatch;
  if (!partial) {
    data.name ??= "";
    data.trigger ??= "";
    data.responseContent ??= "";
    data.matchType ??= "contains";
    data.responseType ??= "text";
    data.cooldownSeconds ??= 0;
    data.perUserCooldownSeconds ??= 0;
    data.priority ??= 0;
    data.deleteAfterSeconds ??= 0;
    data.caseSensitive ??= false;
    data.stopOnMatch ??= true;
    data.allowedChannelIds ??= [];
    data.ignoredChannelIds ??= [];
    data.allowedRoleIds ??= [];
    data.ignoredRoleIds ??= [];
  }
  if (data.responseType === "random" && data.responseContent) {
    data.randomResponses = data.responseContent.split(/\s*\|\|\s*/).filter(Boolean).slice(0, 10);
  }
  return data;
}
const textOption = (name, description, required = false, max = 1000) => ({ type: 3, name, description, required, max_length: max });
const intOption = (name, description, min, max) => ({ type: 4, name, description, min_value: min, max_value: max });
const boolOption = (name, description) => ({ type: 5, name, description });
const choiceOption = (name, description, values) => ({ type: 3, name, description, choices: values.map((value) => ({ name: value.replaceAll("_", " "), value })) });
const addEditOptions = (required) => [
  textOption("name", "Short rule name.", required, 50),
  textOption("response", "Response text; random choices separated by ||.", required, 1800),
  textOption("trigger", "Keyword, phrase, or trigger value (not needed for attachment/mention triggers).", false, 200),
  choiceOption("match_type", "How the trigger is matched.", MATCH_TYPES),
  choiceOption("response_type", "How Avero responds.", RESPONSE_TYPES),
  intOption("cooldown", "Server-wide cooldown in seconds.", 0, 86400),
  intOption("user_cooldown", "Per-user cooldown in seconds.", 0, 86400),
  intOption("priority", "Higher priority rules run first.", -100, 100),
  textOption("allowed_channels", "Optional comma-separated channel IDs.", false, 1000),
  textOption("ignored_channels", "Comma-separated ignored channel IDs.", false, 1000),
  textOption("allowed_roles", "Optional comma-separated allowed role IDs.", false, 1000),
  textOption("ignored_roles", "Comma-separated ignored role IDs.", false, 1000),
  boolOption("case_sensitive", "Match capitalization exactly."),
  boolOption("stop_on_match", "Stop after this matching rule."),
  intOption("delete_after", "Delete Avero's response after seconds (0 disables).", 0, 86400)
];

export const autoresponderCommand = Object.freeze({
  data: Object.freeze({
    name: "autoresponder",
    description: "Create and manage automatic server responses.",
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    dm_permission: false,
    options: [
      { type: 1, name: "add", description: "Create an automatic response rule.", options: addEditOptions(true) },
      { type: 1, name: "edit", description: "Edit an existing rule.", options: [
        textOption("rule_id", "Rule ID from the list.", true, 30), ...addEditOptions(false)
      ]},
      { type: 1, name: "remove", description: "Delete a response rule.", options: [textOption("rule_id", "Rule ID from the list.", true, 30)] },
      { type: 1, name: "toggle", description: "Enable or pause a response rule.", options: [
        textOption("rule_id", "Rule ID from the list.", true, 30),
        { type: 5, name: "enabled", description: "Whether the rule is enabled.", required: true }
      ]},
      { type: 1, name: "list", description: "List rules and response statistics." },
      { type: 1, name: "logs", description: "View the latest response execution logs." },
      { type: 1, name: "test", description: "Preview a rule's response without sending it.", options: [textOption("rule_id", "Rule ID from the list.", true, 30)] }
    ]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Autoresponder requires a database client.");
    if (!interaction.guildId || !isAdmin(interaction)) {
      await interaction.reply(ephemeral("You need **Manage Server** to manage autoresponder rules."));
      return;
    }
    const action = interaction.options.getSubcommand();
    if (action === "list") {
      const [rules, stats] = await Promise.all([
        listAutoResponseRules(prisma, interaction.guildId, { force: true }),
        getAutoResponseStats(prisma, interaction.guildId)
      ]);
      const lines = rules.length ? rules.slice(0, 8).map((rule) =>
        "**" + rule.name + "** · " + (rule.enabled ? "Enabled" : "Paused") + " · " + rule.matchType + " · " + rule.responseType +
        "\nID: " + rule.id + " · Priority " + rule.priority + " · Cooldown " + rule.cooldownSeconds + "s / user " + rule.perUserCooldownSeconds + "s"
      ) : ["No rules yet. Use /autoresponder add to create one."];
      await interaction.reply(ephemeral("## Avero Autoresponder\n" + lines.join("\n\n") +
        "\n\n**Activity:** " + stats.total.toLocaleString("en-US") + " successful responses total · " +
        stats.recent.toLocaleString("en-US") + " in the last 24 hours\nUse /autoresponder edit, toggle, or remove with a rule ID."));
      return;
    }
    if (action === "logs") {
      const logs = await getAutoResponseLogs(prisma, interaction.guildId, 10);
      const lines = logs.length ? logs.map((entry) =>
        "<t:" + Math.floor(entry.createdAt.getTime() / 1000) + ":R> · " + entry.status +
        " · rule " + entry.ruleId + " · <@" + entry.userId + "> · <#" + entry.channelId + ">"
      ) : ["No autoresponder executions have been logged yet."];
      await interaction.reply(ephemeral("## Recent autoresponder activity\n" + lines.join("\n")));
      return;
    }
    const ruleId = str(interaction, "rule_id");
    if (action === "add") {
      const current = await listAutoResponseRules(prisma, interaction.guildId, { force: true });
      if (current.length >= 50) throw new Error("This server has reached the 50-rule limit. Remove an unused rule first.");
      const data = readRuleOptions(interaction);
      if (!data.name || !data.trigger && !["attachment", "user_mention", "bot_mention"].includes(data.matchType) || !data.responseContent) {
        throw new Error("Name, response, and a trigger value (except for attachment/mention triggers) are required.");
      }
      if (data.responseType === "random" && data.responseContent.split(/\s*\|\|\s*/).filter(Boolean).length < 2) {
        throw new Error("Random responses need at least two choices separated by ||.");
      }
      const rule = await createAutoResponseRule(prisma, interaction.guildId, data);
      await interaction.reply(ephemeral("Created **" + rule.name + "**. Rule ID: " + rule.id + ". It is enabled by default."));
      return;
    }
    if (action === "edit") {
      const data = readRuleOptions(interaction, true);
      if (!Object.keys(data).length) throw new Error("Supply at least one setting to update.");
      const existing = (await listAutoResponseRules(prisma, interaction.guildId, { force: true })).find((entry) => entry.id === ruleId);
      const nextType = data.responseType ?? existing?.responseType;
      const nextContent = data.responseContent ?? existing?.responseContent;
      if (nextType === "random" && data.responseContent !== undefined) {
        data.randomResponses = nextContent.split(/\\s*\\|\\|\\s*/).filter(Boolean).slice(0, 10);
        if (data.randomResponses.length < 2) throw new Error("Random responses need at least two choices separated by ||.");
      }
      const count = await updateAutoResponseRule(prisma, interaction.guildId, ruleId, data);
      await interaction.reply(ephemeral(count ? "Rule updated." : "I couldn't find that rule in this server."));
      return;
    }
    if (action === "remove") {
      const count = await deleteAutoResponseRule(prisma, interaction.guildId, ruleId);
      await interaction.reply(ephemeral(count ? "Rule removed." : "I couldn't find that rule in this server."));
      return;
    }
    if (action === "toggle") {
      const enabled = bool(interaction, "enabled");
      const count = await updateAutoResponseRule(prisma, interaction.guildId, ruleId, { enabled });
      await interaction.reply(ephemeral(count ? "Rule " + (enabled ? "enabled." : "paused.") : "I couldn't find that rule in this server."));
      return;
    }
    if (action === "test") {
      const rules = await listAutoResponseRules(prisma, interaction.guildId, { force: true });
      const rule = rules.find((entry) => entry.id === ruleId);
      await interaction.reply(ephemeral(rule
        ? "## Preview · " + rule.name + "\n" + (rule.responseType === "random" ? rule.randomResponses[0] : rule.responseContent) + "\n\nPreview only — no message was sent."
        : "I couldn't find that rule in this server."));
    }
  }
});
