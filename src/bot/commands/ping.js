import { MessageFlags } from "discord.js";
import { createPanel, discordTimestamp, ICONS, THEME } from "../../../averoui/index.js";

export const pingCommand = Object.freeze({
  data: Object.freeze({
    name: "ping",
    description: "Check Avero's connection and response latency."
  }),

  async execute(interaction) {
    const interactionLatency = Math.max(0, Date.now() - interaction.createdTimestamp);
    const gatewayLatency = interaction.client.ws.ping;
    const gatewayStatus = gatewayLatency >= 0 ? "`" + gatewayLatency + " ms`" : "`Connecting`";

    const panel = createPanel({
      eyebrow: "AVERO  /  SYSTEM MONITOR",
      title: ICONS.brand + " PONG",
      description: ICONS.success + " **All systems operational**\nThe Discord interaction pipeline is responding normally.",
      accentColor: THEME.colors.success,
      sections: [
        "**INTERACTION LATENCY**\n`" + interactionLatency + " ms`",
        "**GATEWAY HEARTBEAT**\n" + gatewayStatus
      ],
      footer: "AVEROUI  /  COMPONENTS V2  /  " + discordTimestamp(new Date(interaction.createdTimestamp), "t")
    });

    await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [panel]
    });
  }
});
