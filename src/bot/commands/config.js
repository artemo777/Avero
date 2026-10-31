import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder,
  PermissionFlagsBits, TextInputBuilder, TextInputStyle
} from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";
import { getGuildSettings, updateGuildSettings } from "../../db/guild-settings-repository.js";
const SUPPORT_URL = "https://discord.com/channels/1434292419788017766/1434554043581337601";
const ROLE_ID_PATTERN = /^\d{17,20}$/;
const IMAGE_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
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
      textInput("gamesEnabled", "Games enabled? true / false", settings.gamesEnabled, { required: true }),
      textInput("currencyEnabled", "Currency enabled? true / false", settings.currencyEnabled, { required: true }),
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
      textInput("bio", "Server bio (max 190 chars; 'clear' removes)", "", { maxLength: 190 }),
      textInput("avatarUrl", "Avatar URL (Discord CDN or 'clear')", "", { maxLength: 1000 }),
      textInput("bannerUrl", "Banner URL (Discord CDN or 'clear')", "", { maxLength: 1000 })
    );
  }
  return modal;
}
async function readDiscordImage(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !IMAGE_HOSTS.has(url.hostname)) throw new Error("Use an HTTPS image link from cdn.discordapp.com or media.discordapp.net.");
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Could not load that image.");
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "https:" || !IMAGE_HOSTS.has(finalUrl.hostname)) throw new Error("That image link redirected outside the Discord CDN.");
  const type = response.headers.get("content-type")?.split(";")[0]?.toLowerCase();
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(type)) throw new Error("The link must point to a PNG, JPG, WEBP or GIF image.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("Images must be under 8 MB.");
  return buffer;
}
export const configCommand = Object.freeze({
  data: Object.freeze({ name: "config", description: "Open Avero's server settings for games, currency and profile." }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Config command requires a database client.");
    if (!canManage(interaction)) {
      await interaction.reply({ content: "You need **Manage Server** to edit Avero settings.", flags: MessageFlags.Ephemeral });
      return;
    }
    const settings = await getGuildSettings(prisma, interaction.guildId);
    await interaction.reply({
      embeds: [createEmbed({
        title: "◈ Avero · Server control",
        description: "One clean panel. Your settings only affect **this server**.",
        color: THEME.colors.primary,
        fields: [
          { name: "Games", value: settings.gamesEnabled ? "Enabled" : "Paused", inline: true },
          { name: "Currency", value: settings.currencyEnabled ? "Enabled" : "Paused", inline: true },
          { name: "Daily drop", value: settings.dailyReward + " coins", inline: true },
          { name: "Role perks", value: [settings.boosterRoleId ? "Booster set" : "Booster —", settings.funderRoleId ? "Funder set" : "Funder —", settings.voterRoleId ? "Voter set" : "Voter —"].join("\\n") }
        ],
        footer: "Manage Server required · changes are server-only"
      })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("avero-config|games").setLabel("Games & Currency").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("avero-config|roles").setLabel("Role perks").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("avero-config|profile").setLabel("Server profile").setStyle(ButtonStyle.Secondary)
      )],
      flags: MessageFlags.Ephemeral
    });
  }
});
export async function handleConfigButton(interaction, prisma) {
  if (!interaction.customId?.startsWith("avero-config|")) return false;
  if (!interaction.guildId || !canManage(interaction)) {
    await interaction.reply({ content: "Only server admins with **Manage Server** can edit this panel.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const kind = interaction.customId.split("|")[1];
  if (!["games", "roles", "profile"].includes(kind)) {
    await interaction.reply({ content: "That settings page is no longer available.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const settings = await getGuildSettings(prisma, interaction.guildId);
  await interaction.showModal(configModal(kind, settings));
  return true;
}
export async function handleConfigModal(interaction, prisma) {
  if (!interaction.customId?.startsWith("avero-config-modal|")) return false;
  if (!interaction.guildId || !canManage(interaction)) {
    await interaction.reply({ content: "Only server admins with **Manage Server** can save these settings.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const kind = interaction.customId.split("|")[1];
  if (kind === "games") {
    const parseBoolean = (id) => {
      const value = interaction.fields.getTextInputValue(id).trim().toLowerCase();
      if (value !== "true" && value !== "false") throw new Error(id + " must be true or false.");
      return value === "true";
    };
    const parseAmount = (id) => {
      const value = Number(interaction.fields.getTextInputValue(id).trim());
      if (!Number.isSafeInteger(value) || value < 1 || value > 100000) throw new Error(id + " must be between 1 and 100000.");
      return value;
    };
    const dailyReward = parseAmount("dailyReward");
    const workMinReward = parseAmount("workMinReward");
    const workMaxReward = parseAmount("workMaxReward");
    if (workMinReward > workMaxReward) throw new Error("Work minimum cannot exceed work maximum.");
    await updateGuildSettings(prisma, interaction.guildId, {
      gamesEnabled: parseBoolean("gamesEnabled"), currencyEnabled: parseBoolean("currencyEnabled"),
      dailyReward, workMinReward, workMaxReward
    });
    await interaction.reply({ content: "✓ Games & Currency settings saved for this server.", flags: MessageFlags.Ephemeral });
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
    await interaction.reply({ content: "✓ Booster, Funder and Voter roles saved.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (kind === "profile") {
    const bioValue = interaction.fields.getTextInputValue("bio").trim();
    const avatarValue = interaction.fields.getTextInputValue("avatarUrl").trim();
    const bannerValue = interaction.fields.getTextInputValue("bannerUrl").trim();
    const changes = {};
    if (bioValue) changes.bio = bioValue.toLowerCase() === "clear" ? null : bioValue;
    if (avatarValue) changes.avatar = avatarValue.toLowerCase() === "clear" ? null : await readDiscordImage(avatarValue);
    if (bannerValue) changes.banner = bannerValue.toLowerCase() === "clear" ? null : await readDiscordImage(bannerValue);
    if (!Object.keys(changes).length) throw new Error("Add at least one profile change.");
    await interaction.guild.members.editMe(changes);
    await interaction.reply({ content: "✓ Avero's **server profile** was updated. This does not change the global bot profile.", flags: MessageFlags.Ephemeral });
    return true;
  }
  await interaction.reply({ content: "That settings page is no longer available.", flags: MessageFlags.Ephemeral });
  return true;
}
export const AVERO_SUPPORT_URL = SUPPORT_URL;