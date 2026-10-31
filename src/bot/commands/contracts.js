import { MessageFlags } from "discord.js";
import { THEME } from "../../../averoui/theme.js";
import { createGamePanel, gamePayload } from "../game-ui.js";
import { claimDailyContract, DAILY_CONTRACTS, getDailyContracts } from "../../db/currency-repository.js";

export const contractsCommand = Object.freeze({
  data: Object.freeze({
    name: "contracts",
    description: "Check today's goals and claim your bonus coins.",
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
    let description = "Three daily goals. Finish them for bonus coins · resets at 00:00 UTC.";
    if (result?.claimed) {
      description = "✦ **+" + result.amount + " coins** · " + DAILY_CONTRACTS.find((contract) => contract.id === selectedContract).title + " claimed.";
    } else if (result?.reason === "incomplete") {
      description = "Not quite yet · " + result.progress + "/" + result.target + ".";
    } else if (result?.reason === "already_claimed") {
      description = "You already claimed this one today.";
    }
    const sections = snapshot.contracts.map((contract) => {
      const status = contract.claimed ? "✓ Claimed" : contract.complete
        ? "Ready to claim · `/contracts claim:" + contract.id + "`"
        : "In progress";
      return "**" + contract.title + "** · " + contract.progress + "/" + contract.target +
        "\n+" + contract.reward + " coins · " + status;
    });
    await interaction.reply(gamePayload(createGamePanel({
      title: "Daily contracts",
      eyebrow: "COINS",
      description,
      sections,
      color: result?.claimed ? THEME.colors.success : THEME.colors.primary,
      footer: "DAILY GOALS · SERVER PROGRESS"
    })));
  }
});
