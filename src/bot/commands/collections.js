import { MessageFlags } from "discord.js";
import { renderCollectionSets } from "../game-ui.js";

export const collectionsCommand = Object.freeze({
  data: Object.freeze({
    name: "collections",
    description: "Track themed collectible sets and their cosmetic titles.",
    options: [{
      type: 6,
      name: "member",
      description: "Member whose collection sets you want to inspect.",
      required: false
    }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Collections command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Avero collection sets are available inside a server.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const target = interaction.options.getUser("member") ?? interaction.user;
    await interaction.reply(await renderCollectionSets(
      prisma,
      interaction.guildId,
      target.id,
      interaction.user.id
    ));
  }
});
