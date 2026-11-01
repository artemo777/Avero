import { MessageFlags } from "discord.js";
import { createGamePanel, gamePayload } from "../game-ui.js";
import { createMoneyRequest } from "../../db/money-request-repository.js";

export const askCommand = Object.freeze({
  data: Object.freeze({
    name: "ask",
    description: "Request virtual coins from another server member.",
    options: [
      { type: 6, name: "member", description: "Who you're asking.", required: true },
      { type: 4, name: "amount", description: "Virtual coins to request (1–10,000).", required: true, min_value: 1, max_value: 10000 }
    ]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Ask command requires a database client.");
    const target = interaction.options.getUser("member", true);
    if (target.bot) {
      await interaction.reply({ content: "You can only request coins from another member.", flags: MessageFlags.Ephemeral });
      return;
    }
    try {
      const request = await createMoneyRequest(prisma, interaction.guildId, interaction.user.id, target.id, interaction.options.getInteger("amount", true));
      const payload = gamePayload(createGamePanel({
        title: "Coin request",
        eyebrow: "AVERO / WALLET",
        description: "<@" + target.id + "> · **" + request.amount.toLocaleString("en-US") + " virtual coins**\n\nThis request expires in 10 minutes. The recipient can accept or decline.",
        footer: "GLOBAL COINS · NO REAL-MONEY VALUE",
        buttons: [
          { customId: "avero-ask|" + request.id + "|accept", label: "Accept", style: 3 },
          { customId: "avero-ask|" + request.id + "|decline", label: "Decline", style: 2 }
        ]
      }));
      await interaction.reply({ ...payload, allowedMentions: { users: [target.id] } });
    } catch (error) {
      await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral });
    }
  }
});
