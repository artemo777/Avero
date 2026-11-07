import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder,
  PermissionFlagsBits, RoleSelectMenuBuilder, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle
} from "discord.js";
import { THEME } from "../../../averoui/theme.js";
import { createGamePanel, gamePayload } from "../game-ui.js";
import { getGuildSettings, updateGuildSettings, GUILD_PROFILE_THEMES } from "../../db/guild-settings-repository.js";
import {
  getAutoReactionSettings, updateAutoReactionSettings, getAutoReactionRolePerks,
  upsertAutoReactionRolePerk, removeAutoReactionRolePerk
} from "../../db/auto-reaction-repository.js";
import { normalizeReactionEmoji } from "../auto-reactions.js";
import { handleActivityConfigButton, handleActivityConfigModal } from "../activity-config.js";

const SUPPORT_URL = "https://discord.com/channels/1434292419788017766/1434554043581337601";
const ROLE_ID_PATTERN = /^\d{17,20}$/;
const THEME_COLORS = Object.freeze({ violet: 0x8b5cf6, ocean: 0x0ea5e9, sunset: 0xf97316, mint: 0x10b981, mono: 0x64748b });
const THEME_LABELS = Object.freeze({ violet: "Violet", ocean: "Ocean", sunset: "Sunset", mint: "Mint", mono: "Mono" });
const UNICODE_REACTION_CHOICES = Object.freeze([
  ["🎉", "Party popper"], ["❤️", "Red heart"], ["🔥", "Fire"], ["⭐", "Star"],
  ["💎", "Gem"], ["✨", "Sparkles"], ["😂", "Laughing"], ["👀", "Eyes"],
  ["🚀", "Rocket"], ["💜", "Purple heart"], ["👍", "Thumbs up"], ["🏆", "Trophy"],
  ["🎮", "Game controller"], ["🌟", "Glowing star"], ["🥳", "Party face"],
  ["💯", "Hundred points"], ["🫡", "Saluting face"], ["🤝", "Handshake"]
]);
function roleSelectRow(customId, placeholder) {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1)
  );
}
function reactionEmojiModal(roleId) {
  const input = new TextInputBuilder()
    .setCustomId("reactionEmoji")
    .setLabel("Paste one emoji")
    .setPlaceholder("🔥 or <:name:id> or <a:name:id>")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);
  return new ModalBuilder()
    .setCustomId("avero-config-modal|reaction-emoji|" + roleId)
    .setTitle("Paste reaction emoji")
    .addComponents(new ActionRowBuilder().addComponents(input));
}
function emojiPickerRows(guild, roleId, customEmojis) {
  const unicodeMenu = new StringSelectMenuBuilder()
    .setCustomId("avero-config-select|reaction-unicode|" + roleId)
    .setPlaceholder("Choose a Unicode emoji")
    .addOptions(UNICODE_REACTION_CHOICES.map(([emoji, label]) =>
      new StringSelectMenuOptionBuilder().setLabel(label).setValue(emoji).setEmoji(emoji)
    ));
  const rows = [new ActionRowBuilder().addComponents(unicodeMenu)];
  if (customEmojis.length) {
    const customMenu = new StringSelectMenuBuilder()
      .setCustomId("avero-config-select|reaction-custom|" + roleId)
      .setPlaceholder("Choose a custom server emoji")
      .addOptions(customEmojis.slice(0, 25).map((emoji) =>
        new StringSelectMenuOptionBuilder()
          .setLabel((emoji.name || "server-emoji").slice(0, 100))
          .setValue(emoji.id)
          .setEmoji({ id: emoji.id, name: emoji.name || undefined, animated: emoji.animated })
      ));
    rows.push(new ActionRowBuilder().addComponents(customMenu));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("avero-config-select|reaction-paste|" + roleId)
      .setLabel("Paste any emoji")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("avero-config-select|reaction-cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
  ));
  return rows;
}
async function showReactionRolePicker(interaction, mode) {
  const isRemove = mode === "remove";
  await interaction.reply({
    content: isRemove
      ? "Select the server role whose reaction perk you want to remove."
      : "Select the server role that should receive a reaction perk. You can edit an existing role too.",
    components: [roleSelectRow("avero-config-select|reaction-role|" + mode, "Choose a server role")],
    flags: MessageFlags.Ephemeral
  });
}

function canManage(interaction) {
  const permissions = interaction.memberPermissions ?? interaction.member?.permissions;
  return Boolean(
    permissions?.has(PermissionFlagsBits.Administrator) ||
    permissions?.has(PermissionFlagsBits.ManageGuild)
  );
}
function textInput(id, label, value, { style = TextInputStyle.Short, required = false, maxLength = 1000 } = {}) {
  const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(maxLength);
  if (value !== undefined && value !== null && String(value).length) input.setValue(String(value).slice(0, maxLength));
  return new ActionRowBuilder().addComponents(input);
}
function configModal(kind, settings) {
  const modal = new ModalBuilder().setCustomId("avero-config-modal|" + kind)
    .setTitle(kind === "games" ? "Games & Currency" : kind === "roles" ? "Role perks" :
      kind === "reaction-add" ? "Add reaction perk" : kind === "reaction-remove" ? "Remove reaction perk" : "Avero server profile");
  if (kind === "games") {
    modal.addComponents(
      textInput("dailyReward", "Daily coins (1–100000)", settings.dailyReward, { required: true }),
      textInput("workMinReward", "Work minimum (1–100000)", settings.workMinReward, { required: true }),
      textInput("workMaxReward", "Work maximum (1–100000)", settings.workMaxReward, { required: true })
    );
  } else if (kind === "roles") {
    modal.addComponents(
      textInput("boosterRoleId", "Booster role ID (blank = off)", settings.boosterRoleId),
      textInput("funderRoleId", "Funder role ID (blank = off)", settings.funderRoleId),
      textInput("voterRoleId", "Voter role ID (blank = off)", settings.voterRoleId)
    );
  } else if (kind === "reaction-add") {
    modal.addComponents(
      textInput("reactionRoleId", "Discord role ID", "", { required: true, maxLength: 20 }),
      textInput("reactionEmoji", "One emoji (Unicode or server custom)", "", { required: true, maxLength: 100 })
    );
  } else if (kind === "reaction-remove") {
    modal.addComponents(
      textInput("reactionRoleId", "Discord role ID to remove", "", { required: true, maxLength: 20 })
    );
  } else {
    modal.addComponents(
      textInput("profileName", "Avero display name (max 32)", settings.profileName, { maxLength: 32 }),
      textInput("profileBio", "Server profile bio (max 190)", settings.profileBio, { style: TextInputStyle.Paragraph, maxLength: 190 })
    );
  }
  return modal;
}
async function buildReactionPerksPanel(prisma, guildId, guildName) {
  const [settings, perks] = await Promise.all([
    getAutoReactionSettings(prisma, guildId),
    getAutoReactionRolePerks(prisma, guildId)
  ]);
  const perkLines = perks.length
    ? perks.map((perk) => "<@&" + perk.roleId + "> · " + perk.emoji).join("\n")
    : "No role perks configured yet.";
  const buttons = [
    { customId: "avero-config|reaction-add", label: "Add / edit role", style: ButtonStyle.Primary },
    { customId: "avero-config|reaction-remove", label: "Remove role", style: ButtonStyle.Secondary },
    { customId: "avero-config|reaction-toggle", label: settings.enabled ? "Pause perks" : "Enable perks", style: settings.enabled ? ButtonStyle.Secondary : ButtonStyle.Success },
    { customId: "avero-config|reaction-back", label: "Back to config", style: ButtonStyle.Secondary }
  ];
  return gamePayload(createGamePanel({
    title: "Reaction Perks",
    eyebrow: "AVERO • CONFIG",
    description: "Settings for **" + guildName + "**. Avero reacts only when a member with a configured role mentions another user.",
    color: THEME.colors.primary,
    sections: [
      "**STATUS** · " + (settings.enabled ? "Enabled" : "Paused"),
      "**ROLE REACTIONS**\n" + perkLines,
      "**HOW IT WORKS**\nNormal messages never trigger reactions. Each matching role adds its configured emoji. Duplicate emojis are added only once. Use Add / edit role to assign one emoji per role."
    ],
    buttons,
    footer: "MANAGE SERVER REQUIRED • ONLY AFFECTS THIS SERVER",
    separators: true
  }));
}
export function buildConfigPanel(settings, guildName) {
  const theme = THEME_COLORS[settings.profileTheme] ?? THEME.colors.primary;
  const themeLabel = THEME_LABELS[settings.profileTheme] || "Violet";
  const profileName = settings.profileName || "Avero";
  const profileBio = settings.profileBio || "No bio set.";
  const roleStatus = (id) => id ? "Configured" : "Not set";

  const buttons = [
    { customId: "avero-config|toggle-games", label: settings.gamesEnabled ? "Pause games" : "Enable games", style: settings.gamesEnabled ? ButtonStyle.Secondary : ButtonStyle.Success },
    { customId: "avero-config|toggle-currency", label: settings.currencyEnabled ? "Pause currency" : "Enable currency", style: settings.currencyEnabled ? ButtonStyle.Secondary : ButtonStyle.Success },
    { customId: "avero-config|games", label: "Edit rewards & limits", style: ButtonStyle.Primary },
    { customId: "avero-config|roles", label: "Configure economy roles", style: ButtonStyle.Secondary },
    { customId: "avero-config|reaction-perks", label: "Reaction perks", style: ButtonStyle.Success },
    { customId: "avero-config|activity", label: "Activity leaderboards", style: ButtonStyle.Primary },
    { customId: "avero-config|autoresponder", label: "Autoresponder", style: ButtonStyle.Primary },
    { customId: "avero-config|profile", label: "Edit server profile", style: ButtonStyle.Primary },
    ...GUILD_PROFILE_THEMES.map((name) => ({
      customId: "avero-config|theme|" + name,
      label: (settings.profileTheme === name ? "✓ " : "") + THEME_LABELS[name],
      style: settings.profileTheme === name ? ButtonStyle.Success : ButtonStyle.Secondary
    }))
  ];
  return gamePayload(createGamePanel({
    title: "Server settings",
    eyebrow: "AVERO • CONFIG",
    description: "Settings for **" + guildName + "**. Changes here only affect this server.",
    color: theme,
    sections: [
      "**01 · SYSTEM**\n**Games** · " + (settings.gamesEnabled ? "Enabled" : "Paused") + "\n**Currency** · " + (settings.currencyEnabled ? "Enabled" : "Paused"),
      "**02 · ECONOMY & REWARDS**\n**Daily claim** · " + settings.dailyReward.toLocaleString("en-US") + " coins\n**Work payout** · " + settings.workMinReward.toLocaleString("en-US") + "–" + settings.workMaxReward.toLocaleString("en-US") + " coins",
      "**03 · ROLE PERKS**\n**Booster** · " + roleStatus(settings.boosterRoleId) + "\n**Funder** · " + roleStatus(settings.funderRoleId) + "\n**Voter** · " + roleStatus(settings.voterRoleId),
      "**04 · SERVER PROFILE**\n**Display name** · " + profileName + "\n**Bio** · " + profileBio + "\n**Appearance** · " + themeLabel + " theme\nChange the server avatar with /config profile_image."
    ],
    buttons,
    footer: "MANAGE SERVER REQUIRED • ONLY AFFECTS THIS SERVER",
    separators: true
  }));
}
async function loadUploadedAvatar(attachment) {
  if (!attachment) return null;
  const url = new URL(attachment.url);
  if (url.protocol !== "https:" || !["cdn.discordapp.com", "media.discordapp.net"].includes(url.hostname)) throw new Error("Upload the image directly in Discord.");
  if (!/^image\/(png|jpeg|webp|gif)$/i.test(attachment.contentType || "")) throw new Error("Profile artwork must be PNG, JPG, WEBP or GIF.");
  if (attachment.size > 8 * 1024 * 1024) throw new Error("Profile artwork must be under 8 MB.");
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Discord could not load that upload. Please try again.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new Error("Profile artwork must be under 8 MB.");
  return buffer;
}
export const configCommand = Object.freeze({
  data: Object.freeze({
    name: "config",
    description: "Open Manage Avero for this server.",
    options: [{ type: 11, name: "profile_image", description: "Optional image upload for Avero's server-specific avatar.", required: false }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Config command requires a database client.");
    if (!canManage(interaction)) {
      await interaction.reply({ content: "You need **Manage Server** to change these settings.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    const uploaded = interaction.options.getAttachment("profile_image");
    if (uploaded) {
      const avatar = await loadUploadedAvatar(uploaded);
      await interaction.guild.members.editMe({ avatar });
    }
    const settings = await getGuildSettings(prisma, interaction.guildId);
    await interaction.editReply(buildConfigPanel(settings, interaction.guild.name));
    if (uploaded) await interaction.followUp({ content: "✓ Uploaded artwork applied to Avero's avatar in this server only.", flags: MessageFlags.Ephemeral });
  }
});
export async function handleConfigButton(interaction, prisma) {
  if (!interaction.customId?.startsWith("avero-config|")) return false;
  if (!interaction.guildId || !canManage(interaction)) {
    await interaction.reply({ content: "You need **Manage Server** to edit these settings.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const parts = interaction.customId.split("|");
  const action = parts[1];
  const value = parts[2];
  if (action === "activity" || action.startsWith("activity-")) return handleActivityConfigButton(interaction, prisma);
  if (action === "theme") {
    if (!GUILD_PROFILE_THEMES.includes(value)) {
      await interaction.reply({ content: "That profile theme is unavailable.", flags: MessageFlags.Ephemeral });
      return true;
    }
    await updateGuildSettings(prisma, interaction.guildId, { profileTheme: value });
    const settings = await getGuildSettings(prisma, interaction.guildId);
    await interaction.update(buildConfigPanel(settings, interaction.guild.name));
    return true;
  }
  if (action === "toggle-games" || action === "toggle-currency") {
    const settings = await getGuildSettings(prisma, interaction.guildId);
    const field = action === "toggle-games" ? "gamesEnabled" : "currencyEnabled";
    await updateGuildSettings(prisma, interaction.guildId, { [field]: !settings[field] });
    const next = await getGuildSettings(prisma, interaction.guildId);
    await interaction.update(buildConfigPanel(next, interaction.guild.name));
    return true;
  }
  if (action === "autoresponder") {
    await interaction.update(gamePayload(createGamePanel({
      title: "Autoresponder",
      eyebrow: "AVERO • CONFIG",
      description: "Create automatic server responses with /autoresponder. Manage Server is required.",
      color: THEME.colors.primary,
      sections: [
        "**RULE MANAGEMENT**\n/autoresponder add · Create a rule\n/autoresponder list · View rules and statistics\n/autoresponder logs · Recent execution history\n/autoresponder edit · Change a rule\n/autoresponder toggle · Enable or pause a rule\n/autoresponder remove · Delete a rule\n/autoresponder test · Preview a response",
        "**ADVANCED OPTIONS**\nExact / contains / starts with / ends with matching, attachment and mention triggers, text / embed / reply / random / DM responses, placeholders, role and channel filters, priority, cooldowns and response deletion.",
        "**MESSAGE MILESTONES**\n/autoresponder milestones set · Set a 5k–100k celebration\n/autoresponder milestones list · View all 20 thresholds\n/autoresponder milestones toggle / remove / test · Manage announcements",
        "**IMPORTANT**\nEnable the Message Content Intent for Avero in the Discord Developer Portal. The bot also needs Send Messages; Embed Links is required for embed responses."
      ],
      buttons: [{ customId: "avero-config|autoresponder-back", label: "Back to config", style: ButtonStyle.Secondary }],
      footer: "MANAGE SERVER REQUIRED • ONLY AFFECTS THIS SERVER",
      separators: true
    })));
    return true;
  }
  if (action === "autoresponder-back") {
    const settings = await getGuildSettings(prisma, interaction.guildId);
    await interaction.update(buildConfigPanel(settings, interaction.guild.name));
    return true;
  }
  if (action === "reaction-perks") {
    // Acknowledge the component before database reads; otherwise a slow DB can
    // exceed Discord's 3-second interaction response deadline.
    await interaction.deferUpdate();
    const panel = await buildReactionPerksPanel(prisma, interaction.guildId, interaction.guild.name);
    await interaction.editReply(panel);
    return true;
  }
  if (action === "reaction-toggle") {
    const settings = await getAutoReactionSettings(prisma, interaction.guildId);
    await updateAutoReactionSettings(prisma, interaction.guildId, { enabled: !settings.enabled });
    await interaction.update(await buildReactionPerksPanel(prisma, interaction.guildId, interaction.guild.name));
    return true;
  }
  if (action === "reaction-add" || action === "reaction-remove") {
    await showReactionRolePicker(interaction, action === "reaction-remove" ? "remove" : "add");
    return true;
  }
  if (action === "reaction-back") {
    const settings = await getGuildSettings(prisma, interaction.guildId);
    await interaction.update(buildConfigPanel(settings, interaction.guild.name));
    return true;
  }
  if (!["games", "roles", "profile"].includes(action)) {
    await interaction.reply({ content: "That settings page is no longer available.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const settings = await getGuildSettings(prisma, interaction.guildId);
  await interaction.showModal(configModal(action, settings));
  return true;
}
export async function handleConfigModal(interaction, prisma) {
  if (!interaction.customId?.startsWith("avero-config-modal|")) return false;
  if (!interaction.guildId || !canManage(interaction)) {
    await interaction.reply({ content: "You need **Manage Server** to save these settings.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const [, kind, modalRoleId] = interaction.customId.split("|");
  if (kind.startsWith("activity-")) return handleActivityConfigModal(interaction, prisma);
  if (kind === "reaction-emoji") {
    if (!ROLE_ID_PATTERN.test(modalRoleId || "")) throw new Error("That role selection expired. Please start again.");
    const role = await interaction.guild.roles.fetch(modalRoleId).catch(() => null);
    if (!role || role.id === interaction.guild.id || role.managed) throw new Error("That role is no longer available. Please start again.");
    const parsed = normalizeReactionEmoji(interaction.fields.getTextInputValue("reactionEmoji"));
    let emoji = parsed.value;
    if (parsed.kind === "custom") {
      const customEmoji = await interaction.guild.emojis.fetch(parsed.id).catch(() => null);
      if (!customEmoji || !customEmoji.available) throw new Error("That custom emoji is not available in this server. Copy an emoji from this server and try again.");
      emoji = customEmoji.toString();
    }
    await upsertAutoReactionRolePerk(prisma, interaction.guildId, modalRoleId, emoji);
    await interaction.reply({
      content: "Saved reaction perk: " + role.toString() + " → " + emoji + "\\nAvero accepts any single Unicode emoji or a custom emoji copied from this server.",
      flags: MessageFlags.Ephemeral
    });
    return true;
  }
  if (kind === "reaction-add") {
    const roleId = interaction.fields.getTextInputValue("reactionRoleId").trim();
    if (!ROLE_ID_PATTERN.test(roleId)) throw new Error("Enter a valid Discord role ID.");
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role) throw new Error("I couldn't find that role in this server.");
    const parsed = normalizeReactionEmoji(interaction.fields.getTextInputValue("reactionEmoji"));
    let emoji = parsed.value;
    if (parsed.kind === "custom") {
      const customEmoji = await interaction.guild.emojis.fetch(parsed.id).catch(() => null);
      if (!customEmoji || !customEmoji.available) throw new Error("Choose an available custom emoji from this server.");
      emoji = customEmoji.toString();
    }
    await upsertAutoReactionRolePerk(prisma, interaction.guildId, roleId, emoji);
    await interaction.reply({ content: "Reaction perk saved for " + role.toString() + " → " + emoji + ". It triggers only when this member mentions another user.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (kind === "reaction-remove") {
    const roleId = interaction.fields.getTextInputValue("reactionRoleId").trim();
    if (!ROLE_ID_PATTERN.test(roleId)) throw new Error("Enter a valid Discord role ID.");
    const removed = await removeAutoReactionRolePerk(prisma, interaction.guildId, roleId);
    await interaction.reply({ content: removed ? "Reaction perk removed." : "That role had no reaction perk.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (kind === "games") {
    const parseAmount = (id) => {
      const value = Number(interaction.fields.getTextInputValue(id).trim());
      if (!Number.isSafeInteger(value) || value < 1 || value > 100000) throw new Error(id + " must be between 1 and 100000.");
      return value;
    };
    await updateGuildSettings(prisma, interaction.guildId, {
      dailyReward: parseAmount("dailyReward"),
      workMinReward: parseAmount("workMinReward"),
      workMaxReward: parseAmount("workMaxReward")
    });
    await interaction.reply({ content: "Reward settings saved. You can pause games or currency from the dashboard.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (kind === "roles") {
    const values = {};
    for (const field of ["boosterRoleId", "funderRoleId", "voterRoleId"]) {
      const id = interaction.fields.getTextInputValue(field).trim();
      if (id && !ROLE_ID_PATTERN.test(id)) throw new Error(field + " must be a valid role ID.");
      if (id && !await interaction.guild.roles.fetch(id).catch(() => null)) throw new Error("I couldn't find role " + id + " in this server.");
      values[field] = id || null;
    }
    await updateGuildSettings(prisma, interaction.guildId, values);
    await interaction.reply({ content: "Role perks saved.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (kind === "profile") {
    const profileName = interaction.fields.getTextInputValue("profileName").trim();
    const profileBio = interaction.fields.getTextInputValue("profileBio").trim();
    if (profileName.length > 32 || profileBio.length > 190) throw new Error("Profile name or bio is too long.");
    await updateGuildSettings(prisma, interaction.guildId, {
      profileName: profileName || null,
      profileBio: profileBio || null
    });
    if (profileName) await interaction.guild.members.editMe({ nick: profileName });
    await interaction.reply({ content: "Server profile updated. This only changes Avero in this server.", flags: MessageFlags.Ephemeral });
    return true;
  }
  await interaction.reply({ content: "That settings page is no longer available.", flags: MessageFlags.Ephemeral });
  return true;
}
export const AVERO_SUPPORT_URL = SUPPORT_URL;


export async function handleConfigSelect(interaction, prisma) {
  if (!interaction.customId?.startsWith("avero-config-select|")) return false;
  if (!interaction.guildId || !canManage(interaction)) {
    await interaction.reply({ content: "You need **Manage Server** to edit these settings.", flags: MessageFlags.Ephemeral });
    return true;
  }

  const [, action, extra] = interaction.customId.split("|");
  if (action === "reaction-cancel") {
    await interaction.update({ content: "Reaction perk editing cancelled.", components: [] });
    return true;
  }

  if (action === "reaction-paste") {
    const roleId = extra;
    if (!ROLE_ID_PATTERN.test(roleId || "")) {
      await interaction.reply({ content: "That role selection was invalid. Please start again.", flags: MessageFlags.Ephemeral });
      return true;
    }
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role || role.id === interaction.guild.id || role.managed) {
      await interaction.reply({ content: "That role is no longer available. Please start again.", flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.showModal(reactionEmojiModal(roleId));
    return true;
  }

  if (action === "reaction-role") {
    const mode = extra;
    const roleId = interaction.values?.[0];
    if (!["add", "remove"].includes(mode) || !ROLE_ID_PATTERN.test(roleId || "")) {
      await interaction.update({ content: "That role selection was invalid. Please try again.", components: [] });
      return true;
    }
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role || role.id === interaction.guild.id || role.managed) {
      await interaction.update({ content: "Choose a regular server role that Avero can manage.", components: [] });
      return true;
    }
    if (mode === "remove") {
      const removed = await removeAutoReactionRolePerk(prisma, interaction.guildId, roleId);
      await interaction.update({
        content: removed ? "Removed the reaction perk for " + role.toString() + "." : role.toString() + " did not have a reaction perk.",
        components: []
      });
      return true;
    }

    const customEmojis = [...(await interaction.guild.emojis.fetch().catch(() => new Map())).values()]
      .filter((emoji) => emoji.available)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const visibleCustomCount = Math.min(customEmojis.length, 25);
    await interaction.update({
      content: "Choose a quick emoji below, or select **Paste any emoji** to enter any Unicode emoji or paste a custom emoji copied from this server (including animated emojis)." +
        (customEmojis.length > 25 ? "\\nThe custom emoji menu shows the first 25; paste any other server emoji using its copied emoji text." : "") +
        (customEmojis.length === 0 ? "\\nThis server has no available custom emojis; you can still paste any Unicode emoji." : ""),
      components: emojiPickerRows(interaction.guild, roleId, customEmojis.slice(0, visibleCustomCount))
    });
    return true;
  }

  if (action === "reaction-unicode" || action === "reaction-custom") {
    const roleId = extra;
    if (!ROLE_ID_PATTERN.test(roleId || "")) {
      await interaction.update({ content: "That role selection was invalid.", components: [] });
      return true;
    }
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role || role.managed || role.id === interaction.guild.id) {
      await interaction.update({ content: "That role is no longer available. Please start again.", components: [] });
      return true;
    }

    let emoji;
    if (action === "reaction-unicode") {
      const selected = interaction.values?.[0];
      if (!UNICODE_REACTION_CHOICES.some(([value]) => value === selected)) {
        await interaction.update({ content: "That Unicode emoji choice was invalid.", components: [] });
        return true;
      }
      emoji = selected;
    } else {
      const emojiId = interaction.values?.[0];
      const customEmoji = await interaction.guild.emojis.fetch(emojiId).catch(() => null);
      if (!customEmoji || !customEmoji.available) {
        await interaction.update({ content: "That custom emoji is no longer available in this server. Please choose another.", components: [] });
        return true;
      }
      emoji = customEmoji.toString();
    }

    await upsertAutoReactionRolePerk(prisma, interaction.guildId, roleId, emoji);
    await interaction.update({
      content: "Saved reaction perk: " + role.toString() + " → " + emoji + "\\nAvero will add this reaction when a member with that role mentions another user.",
      components: []
    });
    return true;
  }

  await interaction.reply({ content: "That reaction-perk selection is no longer available. Open Config → Reaction Perks and try again.", flags: MessageFlags.Ephemeral });
  return true;
}
