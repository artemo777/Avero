import { GatewayIntentBits, MessageFlags, PermissionFlagsBits } from "discord.js";
import { createGamePanel, gamePayload } from "../game-ui.js";
import { getAutoReactionSettings, getAutoReactionRolePerks } from "../../db/auto-reaction-repository.js";

const REQUIRED_PERMISSIONS = Object.freeze([
  ["View Channel", PermissionFlagsBits.ViewChannel],
  ["Send Messages", PermissionFlagsBits.SendMessages],
  ["Embed Links", PermissionFlagsBits.EmbedLinks]
]);

export const setupCommand = Object.freeze({
  data: Object.freeze({ name: "setup", description: "Check Avero's setup in this server." }),
  async execute(interaction, { settings, prisma } = {}) {
    if (!settings) throw new Error("Setup command requires server settings.");
    const permissions = interaction.appPermissions;
    const permissionLines = REQUIRED_PERMISSIONS.map(([label, permission]) => {
      const available = Boolean(permissions?.has(permission));
      return (available ? "✓" : "✕") + " **" + label + "**" + (available ? "" : " · needed in this channel");
    });
    const missing = REQUIRED_PERMISSIONS.some(([, permission]) => !permissions?.has(permission));
    const intents = interaction.client?.options?.intents;
    const messageContentRequested = Boolean(intents?.has?.(GatewayIntentBits.MessageContent));
      const featureLines = [
      "**Games** · " + (settings.gamesEnabled ? "Ready" : "Paused by a server admin"),
      "**Currency** · " + (settings.currencyEnabled ? "Ready" : "Paused by a server admin"),
      "**Message Content Intent** · " + (messageContentRequested ? "Requested at runtime · verify it is enabled in the Developer Portal" : "Not requested · text autoresponder triggers will not work")
    ];
    const sections = [
      "**Start here**\n1. Run /games to open the game hub.\n2. Run /daily to claim coins.\n3. Visit /shop and /collections to browse items.",
      "**Server admins**\nUse /config (Manage Server required) to enable or pause features, set rewards, configure role perks and customize Avero's server profile.",
      "**Channel permissions**\n" + permissionLines.join("\n"),
      "**Feature status**\n" + featureLines.join("\n")
    ];
    if (prisma) {
      const [reactions, perks] = await Promise.all([
        getAutoReactionSettings(prisma, interaction.guildId),
        getAutoReactionRolePerks(prisma, interaction.guildId)
      ]);
      sections.push("**Reaction Perks**\n" + (reactions.enabled
        ? (perks.length ? perks.length + " role reaction(s) configured · " + (permissions?.has(PermissionFlagsBits.AddReactions) ? "Add Reactions permission available" : "Add Reactions permission needed") : "Enabled · no role reactions configured")
        : "Paused"));
    }
    const payload = gamePayload(createGamePanel({
      title: "Server setup",
      eyebrow: "AVERO • SETUP",
      description: missing
        ? "Avero is connected, but needs a few channel permissions before every response can display properly."
        : "Avero is connected and the key channel permissions are in place.",
      sections,
      color: missing ? 0xFBBF24 : undefined,
      footer: "RUN /HELP FOR THE FULL COMMAND LIST",
      separators: true
    }));
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  }
});
