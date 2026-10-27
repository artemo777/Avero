import { MessageFlags } from "discord.js";
import { createPanel, ICONS, THEME } from "../../../averoui/index.js";

export const pingCommand = Object.freeze({
  data: Object.freeze({
    name: "ping",
    description: "Check Avero's connection and response latency."
  }),

  async execute(interaction) {
    const interactionLatency = Math.max(0, Date.now() - interaction.createdTimestamp);
    const gatewayLatency = interaction.client.ws.ping;
    const gatewayStatus = gatewayLatency >= 0 ? gatewayLatency + " ms" : "connecting";

    const panel = createPanel({
      title: ICONS.brand + "  Pong",
      description: ICONS.success + "  **Online**  ·  Interaction `" + interactionLatency +
        " ms`  ·  Gateway `" + gatewayStatus + "`",
      accentColor: THEME.colors.success
    });

    await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [panel]
    });
  }
});
