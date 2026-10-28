import { MessageFlags } from "discord.js";
import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";
import { claimDailyReward } from "../../db/currency-repository.js";

const DAILY_REWARD = 100;
const DAILY_COOLDOWN_MS = 86_400_000;

export const dailyCommand = Object.freeze({
  data: Object.freeze({
    name: "daily",
    description: "Claim your daily Avero coin reward."
  }),

  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Daily command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Currency can only be used inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const result = await claimDailyReward(prisma, interaction.guildId, interaction.user.id, {
      amount: DAILY_REWARD,
      cooldownMs: DAILY_COOLDOWN_MS
    });

    if (!result.claimed) {
      const nextClaim = new Date(result.account.lastDailyAt.getTime() + DAILY_COOLDOWN_MS);
      await interaction.reply({
        embeds: [createEmbed({
          title: ICONS.warning + "  Daily already claimed",
          description: "Your next reward is available " + "<t:" + Math.floor(nextClaim.getTime() / 1000) + ":R>.",
          color: THEME.colors.warning,
          footer: "AVERO • YOUR NEXT DROP"
        })],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.reply({
      embeds: [createEmbed({
        title: "✦  DAILY DROP CLAIMED",
        description: "You received **+" + DAILY_REWARD + " coins**.\nNew balance: **" + result.account.balance.toLocaleString("en-US") + " coins**.\n\nCome back tomorrow to keep your collection fund growing.",
        color: THEME.colors.success,
        footer: "AVERO • A LITTLE SOMETHING EVERY DAY"
      })]
    });
  }
});
