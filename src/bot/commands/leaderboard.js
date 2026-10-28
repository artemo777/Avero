import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";
import { levelForExperience } from "../../db/member-repository.js";

const LEADERBOARD_LIMIT = 10;

export const leaderboardCommand = Object.freeze({
  data: Object.freeze({
    name: "leaderboard",
    description: "Show the top 10 members by XP in this server."
  }),

  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Leaderboard command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "The leaderboard can only be used in a server.", ephemeral: true });
      return;
    }

    const profiles = await prisma.memberProfile.findMany({
      where: { guildId: interaction.guildId },
      orderBy: [{ xp: "desc" }, { userId: "asc" }],
      take: LEADERBOARD_LIMIT
    });

    const rows = profiles.length
      ? profiles.map((profile, index) =>
        "**" + (index + 1) + ".** <@" + profile.userId + "> — Level " +
        levelForExperience(profile.xp) + " · " + profile.xp.toLocaleString("en-US") + " XP"
      )
      : ["No one has earned XP here yet. Start chatting to appear on the leaderboard!"];

    await interaction.reply({
      embeds: [createEmbed({
        title: ICONS.level + "  Server leaderboard",
        description: rows.join("\n"),
        color: THEME.colors.primary,
        footer: "Avero • Top " + LEADERBOARD_LIMIT + " by XP · This server only"
      })]
    });
  }
});
