import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { createGamePanel, gamePayload } from "../game-ui.js";

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
    const payload = gamePayload(createGamePanel({
      title: "Server setup",
      eyebrow: "AVERO • SETUP",
      description: missing
        ? "Avero is connected, but needs a few channel permissions before every response can display properly."
        : "Avero is connected and the key channel permissions are in place.",
      sections: [
        "**Start here**\n1. Run /games to open the game hub.\n2. Run /daily to claim coins.\n3. Visit /shop and /collections to browse items.",
        "**Server admins**\nUse /config (Manage Server required) to enable or pause features, set rewards, configure role perks and customize Avero's server profile.",
        "**Channel permissions**\n" + permissionLines.join("\n"),
        "**Feature status**\n" + featureLines.join("\n")
      ],
      color: missing ? 0xFBBF24 : undefined,
      footer: "RUN /HELP FOR THE FULL COMMAND LIST",
      separators: true
    }));
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  }
});
