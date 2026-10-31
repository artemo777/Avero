import { MessageFlags } from "discord.js";
import { renderGames } from "../game-ui.js";

export const gamesCommand = Object.freeze({
  data: Object.freeze({
    name: "games",
    description: "Pick a quick game to play."
  }),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Avero games are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply(renderGames(interaction.user.id));
  }
});
