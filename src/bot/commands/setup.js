import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";

const REQUIRED_PERMISSIONS = Object.freeze([
  ["View Channel", PermissionFlagsBits.ViewChannel],
  ["Send Messages", PermissionFlagsBits.SendMessages],
  ["Embed Links", PermissionFlagsBits.EmbedLinks]
]);

export const setupCommand = Object.freeze({
  data: Object.freeze({ name: "setup", description: "Check Avero's setup in this server." }),
  async execute(interaction, { settings } = {}) {
    if (!settings) throw new Error("Setup command requires server settings.");
    const permissions = interaction.appPermissions;
    const permissionLines = REQUIRED_PERMISSIONS.map(([label, permission]) => {
      const available = Boolean(permissions?.has(permission));
      return (available ? "✓" : "✕") + " **" + label + "**" + (available ? "" : " · needed");
    });
    const missing = REQUIRED_PERMISSIONS.some(([, permission]) => !permissions?.has(permission));
    const featureLines = [
      "**Games** · " + (settings.gamesEnabled ? "Ready" : "Paused by a server admin"),
      "**Currency** · " + (settings.currencyEnabled ? "Ready" : "Paused by a server admin")
    ];
    const description = [
      missing
        ? "Avero is in this server, but it needs a few channel permissions before every response can display properly."
        : "Avero is connected and the key channel permissions are in place.",
      "",
      "**Start here**",
      "1. Run /games to open the game hub.",
      "2. Run /daily to claim coins.",
      "3. Visit /shop and /collections to browse items.",
      "",
      "**Server admins**",
      "Use /config (Manage Server required) to enable or pause features, set rewards, configure role perks and customize Avero's server profile."
    ].join("\n");
    await interaction.reply({
      embeds: [createEmbed({
        title: "Avero · Server setup",
        description,
        color: missing ? THEME.colors.warning : THEME.colors.primary,
        fields: [
          { name: "Channel permissions", value: permissionLines.join("\n") },
          { name: "Feature status", value: featureLines.join("\n") }
        ],
        footer: "Run /help for the full command list"
      })],
      flags: MessageFlags.Ephemeral
    });
  }
});
