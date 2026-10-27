import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";

export const pingCommand = Object.freeze({
  data: Object.freeze({
    name: "ping",
    description: "Check whether Avero is responding."
  }),

  async execute(interaction) {
    await interaction.reply({
      embeds: [
        createEmbed({
          title: "Avero • Pong",
          description: ICONS.success + " Discord connection is responding.",
          color: THEME.colors.success,
          footer: "AveroUI • Shared response style"
        })
      ]
    });
  }
});
