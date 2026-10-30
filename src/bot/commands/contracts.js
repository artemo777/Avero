import { MessageFlags } from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";
import { claimDailyContract, DAILY_CONTRACTS, getDailyContracts } from "../../db/currency-repository.js";

export const contractsCommand = Object.freeze({
  data: Object.freeze({
    name: "contracts",
    description: "View today's free Avero challenges and claim completed rewards.",
    options: [{
      type: 3,
      name: "claim",
      description: "Claim a completed daily contract.",
      required: false,
      choices: DAILY_CONTRACTS.map((contract) => ({
        name: contract.title + " (+" + contract.reward + " coins)",
        value: contract.id
      }))
    }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Contracts command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Daily Contracts are available inside a server.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const selectedContract = interaction.options.getString("claim");
    let result = null;
    if (selectedContract) {
      result = await claimDailyContract(prisma, interaction.guildId, interaction.user.id, selectedContract);
    }

    const snapshot = await getDailyContracts(prisma, interaction.guildId, interaction.user.id);
    const fields = snapshot.contracts.map((contract) => {
      const status = contract.claimed
        ? "Claimed"
        : contract.complete
          ? "Complete · run `/contracts claim:" + contract.id + "`"
          : "In progress";
      return {
        name: contract.title + " · " + contract.progress + "/" + contract.target,
        value: contract.description + "\n**Reward:** " + contract.reward + " coins\n**Status:** " + status
      };
    });

    let description = "Complete today's free goals to earn virtual coins. Progress resets at 00:00 UTC.";
    if (result?.claimed) {
      description = "✨ **+" + result.amount + " coins** · " + DAILY_CONTRACTS.find((contract) => contract.id === selectedContract).title + " claimed.";
    } else if (result?.reason === "incomplete") {
      description = "That contract is not complete yet (" + result.progress + "/" + result.target + "). Keep going!";
    } else if (result?.reason === "already_claimed") {
      description = "You've already claimed that contract today. Your reward was not paid twice.";
    }

    await interaction.reply({
      embeds: [createEmbed({
        title: "📜 Avero Daily Contracts",
        description,
        color: result?.claimed ? THEME.colors.success : THEME.colors.primary,
        fields,
        footer: "Free to complete · no wagers · server-specific progress"
      })]
    });
  }
});
