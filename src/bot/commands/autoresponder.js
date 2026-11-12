import { MessageFlags, PermissionFlagsBits } from "discord.js";
import {
  createAutoResponseRule, deleteAutoResponseRule, getAutoResponseStats, getAutoResponseLogs,
  listAutoResponseRules, updateAutoResponseRule, listAutoResponseMilestones,
  upsertAutoResponseMilestone, removeAutoResponseMilestone, toggleAutoResponseMilestone
} from "../../db/autoresponder-repository.js";
import { isValidMessageMilestone, MESSAGE_MILESTONE_STEP, MESSAGE_MILESTONE_MAX } from "../autoresponder/milestones.js";

const SNOWFLAKE = /^\d{17,20}$/;
const MATCH_TYPES = ["exact", "contains", "starts_with", "ends_with", "attachment", "user_mention", "bot_mention"];
const RESPONSE_TYPES = ["text", "embed", "reply", "random", "dm"];
const MATCH_LABELS = Object.freeze({
  exact: "Exact phrase", contains: "Contains text", starts_with: "Starts with",
  ends_with: "Ends with", attachment: "Message has an attachment",
  user_mention: "Any member is mentioned", bot_mention: "Avero is mentioned"
});
const RESPONSE_LABELS = Object.freeze({
  text: "Send a channel message", embed: "Send an embed", reply: "Reply to the message",
  random: "Choose a random response", dm: "Send a direct message"
});
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
    data.cooldownSeconds ??= 2;
    data.perUserCooldownSeconds ??= 5;
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
export function validateAutoResponseRule(data) {
  const name = String(data?.name ?? "").trim();
  const response = String(data?.responseContent ?? "").trim();
  const matchType = data?.matchType ?? "contains";
  const responseType = data?.responseType ?? "text";
  const trigger = String(data?.trigger ?? "").trim();
  if (!name) throw new Error("Add a rule name so you can recognize it later.");
  if (name.length > 50) throw new Error("Rule names can be up to 50 characters.");
  if (!response) throw new Error("Add the message Avero should send in the Response field.");
  if (response.length > 1800) throw new Error("Responses can be up to 1,800 characters.");
  if (!MATCH_TYPES.includes(matchType)) throw new Error("Choose a valid trigger type from the list.");
  if (!RESPONSE_TYPES.includes(responseType)) throw new Error("Choose a valid response type from the list.");
  if (["exact", "contains", "starts_with", "ends_with"].includes(matchType) && !trigger) {
    throw new Error("This trigger type needs a Trigger value. Add a keyword or phrase, or choose an attachment/member-mention/Avero-mention trigger instead.");
  }
  if (trigger.length > 200) throw new Error("Trigger values can be up to 200 characters.");
  if (responseType === "random" && response.split(/\s*\|\|\s*/).filter(Boolean).length < 2) {
    throw new Error("Random responses need at least two choices separated by ||.");
  }
  return { ...data, name, responseContent: response, matchType, responseType, trigger };
}

const intOption = (name, description, min, max) => ({ type: 4, name, description, min_value: min, max_value: max });
const boolOption = (name, description) => ({ type: 5, name, description });
const choiceOption = (name, description, values, labels = {}) => ({ type: 3, name, description, choices: values.map((value) => ({ name: labels[value] ?? value.replaceAll("_", " "), value })) });
const addEditOptions = (required) => [
  textOption("name", "Short rule name shown in your rule list.", required, 50),
  textOption("response", "What Avero should send. Random: separate up to 10 choices with ||.", required, 1800),
  choiceOption("match_type", "Choose what kind of message should trigger this rule.", MATCH_TYPES, MATCH_LABELS),
  textOption("trigger", "Required for text matching. Leave empty for attachment or mention triggers.", false, 200),
  choiceOption("response_type", "Choose how Avero sends the response.", RESPONSE_TYPES, RESPONSE_LABELS),
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
      { type: 1, name: "guide", description: "Explain trigger types, response types, placeholders, and examples." },
      { type: 1, name: "list", description: "List rules and response statistics." },
      { type: 1, name: "logs", description: "View the latest response execution logs." },
      { type: 2, name: "milestones", description: "Configure member message-count celebrations.", options: [
        { type: 1, name: "set", description: "Set a response for a message milestone.", options: [
          { ...intOption("threshold", "Milestone: 5000, 10000, ... 100000.", MESSAGE_MILESTONE_STEP, MESSAGE_MILESTONE_MAX), required: true },
          textOption("response", "Announcement text. Supports {user}, {username}, {count}, {milestone}, {server}, {channel}.", true, 1800)
        ]},
        { type: 1, name: "remove", description: "Remove a configured milestone.", options: [
          { ...intOption("threshold", "Milestone threshold to remove.", MESSAGE_MILESTONE_STEP, MESSAGE_MILESTONE_MAX), required: true }
        ]},
        { type: 1, name: "toggle", description: "Enable or pause a milestone.", options: [
          { ...intOption("threshold", "Milestone threshold.", MESSAGE_MILESTONE_STEP, MESSAGE_MILESTONE_MAX), required: true },
          { ...boolOption("enabled", "Whether the milestone announcement is enabled."), required: true }
        ]},
        { type: 1, name: "list", description: "List all configured message milestones." },
        { type: 1, name: "test", description: "Preview a milestone announcement privately.", options: [
          { ...intOption("threshold", "Milestone threshold to preview.", MESSAGE_MILESTONE_STEP, MESSAGE_MILESTONE_MAX), required: true }
        ]}
      ]},
      { type: 1, name: "test", description: "Preview a rule's response without sending it.", options: [textOption("rule_id", "Rule ID from the list.", true, 30)] }
    ]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Autoresponder requires a database client.");
    if (!interaction.guildId || !isAdmin(interaction)) {
      await interaction.reply(ephemeral("You need **Manage Server** to manage autoresponder rules."));
      return;
    }
    const group = interaction.options.getSubcommandGroup(false);
    const action = interaction.options.getSubcommand();
    if (group === "milestones") {
      if (action === "list") {
        const configured = await listAutoResponseMilestones(prisma, interaction.guildId);
        const byThreshold = new Map(configured.map((entry) => [entry.threshold, entry]));
        const lines = [];
        for (let threshold = MESSAGE_MILESTONE_STEP; threshold <= MESSAGE_MILESTONE_MAX; threshold += MESSAGE_MILESTONE_STEP) {
          const entry = byThreshold.get(threshold);
          lines.push((entry?.enabled ? "🟢" : entry ? "⏸️" : "⚪") + " **" + threshold.toLocaleString("en-US") + " messages** · " +
            (entry ? (entry.enabled ? "Enabled" : "Paused") : "Not configured"));
        }
        await interaction.reply(ephemeral("## Message milestones\n" + lines.join("\n") +
          "\n\nSet announcements with /autoresponder milestones set."));
        return;
      }
      const threshold = int(interaction, "threshold");
      if (!isValidMessageMilestone(threshold)) throw new Error("Choose a milestone from 5,000 to 100,000 in steps of 5,000.");
      if (action === "set") {
        const response = str(interaction, "response")?.trim();
        if (!response || response.length > 1800) throw new Error("Enter a response between 1 and 1,800 characters.");
        await upsertAutoResponseMilestone(prisma, interaction.guildId, threshold, response);
        await interaction.reply(ephemeral("Saved the **" + threshold.toLocaleString("en-US") + "-message** announcement. It is enabled."));
        return;
      }
      if (action === "remove") {
        const removed = await removeAutoResponseMilestone(prisma, interaction.guildId, threshold);
        await interaction.reply(ephemeral(removed.count ? "Removed the " + threshold.toLocaleString("en-US") + "-message announcement." : "That milestone was not configured."));
        return;
      }
      if (action === "toggle") {
        const enabled = bool(interaction, "enabled");
        const updated = await toggleAutoResponseMilestone(prisma, interaction.guildId, threshold, enabled);
        await interaction.reply(ephemeral(updated.count ? "Milestone " + threshold.toLocaleString("en-US") + " " + (enabled ? "enabled." : "paused.") : "That milestone was not configured."));
        return;
      }
      if (action === "test") {
        const configured = await listAutoResponseMilestones(prisma, interaction.guildId);
        const entry = configured.find((item) => item.threshold === threshold);
        await interaction.reply(ephemeral(entry
          ? "## Preview · " + threshold.toLocaleString("en-US") + " messages\n" + entry.responseContent +
            "\n\nPreview only — no message was sent. Placeholders: {user}, {username}, {count}, {milestone}, {server}, {channel}."
          : "That milestone is not configured yet."));
        return;
      }
      return;
    }
    if (action === "guide") {
      await interaction.reply(ephemeral(
        "## Autoresponder setup guide\n" +
        "**1 · Choose a trigger**\n" +
        "• Exact phrase — the whole message must match.\n" +
        "• Contains text — the message includes your keyword or phrase (default).\n" +
        "• Starts with / Ends with — match the beginning or end.\n" +
        "• Attachment — fires when a message includes an upload; no Trigger value needed.\n" +
        "• Member mention / Avero mention — fires when someone is mentioned; no Trigger value needed.\n\n" +
        "**2 · Write the response**\n" +
        "Use {user}, {username}, {user_id}, {server}, {channel}, {member_count}, {mention}, or {bot}.\n" +
        "For random replies, separate 2–10 choices with ||.\n\n" +
        "**3 · Example**\n" +
        "/autoresponder add name:Welcome response:Welcome {user}! match_type:contains trigger:hello\n\n" +
        "Use /autoresponder test to preview a saved rule. Use list, edit, toggle, and remove to manage it."
      ));
      return;
    }
    if (action === "list") {
      const [rules, stats] = await Promise.all([
        listAutoResponseRules(prisma, interaction.guildId, { force: true }),
        getAutoResponseStats(prisma, interaction.guildId)
      ]);
      const lines = rules.length ? rules.slice(0, 8).map((rule) => {
        const triggerLabel = ["attachment", "user_mention", "bot_mention"].includes(rule.matchType)
          ? MATCH_LABELS[rule.matchType]
          : MATCH_LABELS[rule.matchType] + ": " + (rule.trigger || "(missing)");
        return "**" + rule.name + "** · " + (rule.enabled ? "Enabled" : "Paused") +
          "\n" + triggerLabel + " → " + (RESPONSE_LABELS[rule.responseType] ?? rule.responseType) +
          "\nID: " + rule.id + " · Priority " + rule.priority + " · Cooldown " + rule.cooldownSeconds + "s / user " + rule.perUserCooldownSeconds + "s";
      }) : ["No rules yet. Use /autoresponder add to create one."];
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
      let data;
      try { data = validateAutoResponseRule(readRuleOptions(interaction)); }
      catch (error) {
        await interaction.reply(ephemeral(error.message));
        return;
      }
      const rule = await createAutoResponseRule(prisma, interaction.guildId, data);
      await interaction.reply(ephemeral("Created **" + rule.name + "**. Rule ID: " + rule.id + ". It is enabled by default."));
      return;
    }
    if (action === "edit") {
      const data = readRuleOptions(interaction, true);
      if (!Object.keys(data).length) throw new Error("Supply at least one setting to update.");
      const existing = (await listAutoResponseRules(prisma, interaction.guildId, { force: true })).find((entry) => entry.id === ruleId);
      if (!existing) {
        await interaction.reply(ephemeral("I couldn't find that rule in this server. Run /autoresponder list to see its ID."));
        return;
      }
      const merged = {
        ...existing,
        name: data.name ?? existing.name,
        trigger: data.trigger ?? existing.trigger,
        responseContent: data.responseContent ?? existing.responseContent,
        matchType: data.matchType ?? existing.matchType,
        responseType: data.responseType ?? existing.responseType
      };
      try { validateAutoResponseRule(merged); }
      catch (error) {
        await interaction.reply(ephemeral(error.message));
        return;
      }
      if (merged.responseType === "random") {
        data.randomResponses = merged.responseContent.split(/\s*\|\|\s*/).filter(Boolean).slice(0, 10);
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
