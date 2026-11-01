import { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from "discord.js";
import { createGamePanel, gamePayload } from "./game-ui.js";
import { respondToMoneyRequest } from "../db/money-request-repository.js";

function resultPanel(title, description) {
  return gamePayload(createGamePanel({
    title, description, eyebrow: "AVERO / WALLET", footer: "SERVER COINS ONLY"
  }));
}

export async function handleMoneyRequestButton(interaction, prisma) {
  const [, requestId, decision] = interaction.customId.split("|");
  if (!requestId || !["accept", "decline"].includes(decision)) {
    await interaction.reply({ content: "This request control is invalid.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const result = await respondToMoneyRequest(prisma, interaction.guildId, requestId, interaction.user.id, decision);
  const messages = {
    missing: ["Request unavailable", "This request could not be found."],
    not_target: ["Not your request", "Only the tagged recipient can respond."],
    handled: ["Already handled", "This request has already been answered."],
    expired: ["Request expired", "The 10-minute request window has ended."],
    insufficient_funds: ["Not enough coins", "Your wallet does not have enough coins. No transfer was made."]
  };
  if (!result.completed) {
    await interaction.reply({ content: messages[result.reason]?.[1] ?? "This request is no longer available.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const description = result.accepted
    ? "Transferred **" + result.request.amount.toLocaleString("en-US") + " coins**.\nYour wallet: **" + result.payer.balance.toLocaleString("en-US") + "**."
    : "The request was declined. No coins were moved.";
  await interaction.update(resultPanel(result.accepted ? "Request accepted" : "Request declined", description));
  return true;
}
