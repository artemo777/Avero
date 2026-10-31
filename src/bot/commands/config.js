import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder,
  PermissionFlagsBits, TextInputBuilder, TextInputStyle
} from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";
import { getGuildSettings, updateGuildSettings, GUILD_PROFILE_THEMES } from "../../db/guild-settings-repository.js";

const SUPPORT_URL = "https://discord.com/channels/1434292419788017766/1434554043581337601";
const ROLE_ID_PATTERN = /^\d{17,20}$/;
const THEME_COLORS = Object.freeze({ violet: 0x8b5cf6, ocean: 0x0ea5e9, sunset: 0xf97316, mint: 0x10b981, mono: 0x64748b });
const THEME_LABELS = Object.freeze({ violet: "Violet", ocean: "Ocean", sunset: "Sunset", mint: "Mint", mono: "Mono" });
function canManage(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}
function textInput(id, label, value, { style = TextInputStyle.Short, required = false, maxLength = 1000 } = {}) {
  const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(maxLength);
  if (value !== undefined && value !== null && String(value).length) input.setValue(String(value).slice(0, maxLength));
  return new ActionRowBuilder().addComponents(input);
}
function configModal(kind, settings) {
  const modal = new ModalBuilder().setCustomId("avero-config-modal|" + kind)
    .setTitle(kind === "games" ? "Games & Currency" : kind === "roles" ? "Role perks" : "Avero server profile");
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
  } else {
    modal.addComponents(
      textInput("profileName", "Avero display name (max 32)", settings.profileName, { maxLength: 32 }),
      textInput("profileBio", "Server profile bio (max 190)", settings.profileBio, { style: TextInputStyle.Paragraph, maxLength: 190 })
    );
  }
  return modal;
}
export function buildConfigPanel(settings, guildName) {
  const theme = THEME_COLORS[settings.profileTheme] ?? THEME.colors.primary;
  const themeLabel = THEME_LABELS[settings.profileTheme] || "Violet";
  const profileName = settings.profileName || "Avero";
  const profileBio = settings.profileBio || "No bio set.";
  const roleStatus = (id) => id ? "Configured" : "Not set";

  const embed = createEmbed({
    title: "AVERO  /  SERVER SETTINGS",
    description: [
      "Settings for **" + guildName + "**.",
      "Changes here only affect this server.",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    ].join("\n"),
    color: theme,
    fields: [
      {
        name: "01  ·  SYSTEM",
        value: [
          "**Games**  " + (settings.gamesEnabled ? "🟢 Enabled" : "⚪ Paused"),
          "**Currency**  " + (settings.currencyEnabled ? "🟢 Enabled" : "⚪ Paused")
        ].join("\n"),
        inline: false
      },
      {
        name: "02  ·  ECONOMY & REWARDS",
        value: [
          "**Daily claim**  " + settings.dailyReward.toLocaleString("en-US") + " coins",
          "**Work payout**  " + settings.workMinReward.toLocaleString("en-US") + "–" + settings.workMaxReward.toLocaleString("en-US") + " coins"
        ].join("\n"),
        inline: false
      },
      {
        name: "03  ·  ROLE PERKS",
        value: [
          "**Booster role**  " + roleStatus(settings.boosterRoleId),
          "**Funder role**  " + roleStatus(settings.funderRoleId),
          "**Voter role**  " + roleStatus(settings.voterRoleId)
        ].join("\n"),
        inline: false
      },
      {
        name: "04  ·  SERVER PROFILE",
        value: [
          "**Display name**  " + profileName,
          "**Bio**  " + profileBio,
          "**Appearance**  " + themeLabel + " theme",
          "",
          "Change Avero's server avatar with `/config` and `profile_image`."
        ].join("\n"),
        inline: false
      }
    ],
    footer: "Manage Server required · Only affects this server"
  });

  // Controls are grouped by the same categories as the dashboard above.
  const systemRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("avero-config|toggle-games")
      .setLabel(settings.gamesEnabled ? "Pause games" : "Enable games")
      .setStyle(settings.gamesEnabled ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder().setCustomId("avero-config|toggle-currency")
      .setLabel(settings.currencyEnabled ? "Pause currency" : "Enable currency")
      .setStyle(settings.currencyEnabled ? ButtonStyle.Secondary : ButtonStyle.Success)
  );
  const economyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("avero-config|games")
      .setLabel("Edit rewards & limits").setStyle(ButtonStyle.Primary)
  );
  const rolesRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("avero-config|roles")
      .setLabel("Configure role perks").setStyle(ButtonStyle.Secondary)
  );
  const profileRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("avero-config|profile")
      .setLabel("Edit server profile").setStyle(ButtonStyle.Primary)
  );
  const themesRow = new ActionRowBuilder().addComponents(
    ...GUILD_PROFILE_THEMES.map((name) => new ButtonBuilder()
      .setCustomId("avero-config|theme|" + name)
      .setLabel((settings.profileTheme === name ? "✓ " : "") + THEME_LABELS[name])
      .setStyle(settings.profileTheme === name ? ButtonStyle.Success : ButtonStyle.Secondary))
  );

  return {
    embeds: [embed],
    components: [systemRow, economyRow, rolesRow, profileRow, themesRow],
    flags: MessageFlags.Ephemeral
  };
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
    const uploaded = interaction.options.getAttachment("profile_image");
    if (uploaded) {
      const avatar = await loadUploadedAvatar(uploaded);
      await interaction.guild.members.editMe({ avatar });
    }
    const settings = await getGuildSettings(prisma, interaction.guildId);
    await interaction.reply(buildConfigPanel(settings, interaction.guild.name));
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
  const kind = interaction.customId.split("|")[1];
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
