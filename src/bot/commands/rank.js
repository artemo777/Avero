import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";
import { experienceForLevel, getMemberProfile, levelForExperience } from "../../db/member-repository.js";

export const rankCommand = Object.freeze({
  data: Object.freeze({
    name: "rank",
    description: "View your or another member's level and XP.",
    options: [
      {
        type: 6,
        name: "member",
        description: "Member whose rank you want to view.",
        required: false
      }
    ]
  }),

  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Rank command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "The rank command can only be used in a server.", ephemeral: true });
      return;
    }

    const target = interaction.options.getUser("member") ?? interaction.user;
    const profile = await getMemberProfile(prisma, interaction.guildId, target.id);
    const xp = profile?.xp ?? 0;
    const level = levelForExperience(xp);
    const currentLevelXp = experienceForLevel(level);
    const nextLevelXp = experienceForLevel(level + 1);

    await interaction.reply({
      embeds: [
        createEmbed({
          title: ICONS.level + " " + target.username + "'s rank",
          description: [
            "**Level:** " + level,
            "**Total XP:** " + xp,
            "**Progress:** " + (xp - currentLevelXp) + " / " + (nextLevelXp - currentLevelXp) + " XP to level " + (level + 1)
          ].join("\n"),
          color: THEME.colors.primary,
        })
      ]
    });
  }
});
