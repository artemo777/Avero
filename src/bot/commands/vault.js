import { MessageFlags } from "discord.js";
import { awardDailyVaultReward, recordGameResult } from "../../db/currency-repository.js";
import { renderVault, renderVaultChallenge } from "../game-ui.js";
import { createVaultChallenge } from "../vault-puzzle.js";
import { GUESS_REWARD, GUESS_REWARD_COOLDOWN_MS } from "../economy-rules.js";

export const vaultCommand = Object.freeze({
  data: Object.freeze({
    name: "vault",
    description: "View your server daily three-dial clues or submit a solution. Free to play.",
    options: [{
      type: 3,
      name: "code",
      description: "Enter the three digits from the daily clues.",
      required: false,
      min_length: 3,
      max_length: 3
    }]
  }),
  async execute(interaction, { prisma, now = new Date() } = {}) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "The Vault is available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const guess = interaction.options.getString("code");
    if (guess === null || guess === undefined) {
      await interaction.reply(renderVaultChallenge(createVaultChallenge(interaction.guildId, now), interaction.user.id));
      return;
    }
    if (!prisma) throw new Error("Vault command requires a database client.");
    if (!/^\d{3}$/.test(guess)) {
      await interaction.reply({ content: "Enter exactly three digits (000–999).", flags: MessageFlags.Ephemeral });
      return;
    }

    const challenge = createVaultChallenge(interaction.guildId, now);
    const won = guess === challenge.code;
    const reward = won
      ? await awardDailyVaultReward(prisma, interaction.guildId, interaction.user.id, GUESS_REWARD, {
        cooldownMs: GUESS_REWARD_COOLDOWN_MS,
        now
      })
      : null;
    if (!won) await recordGameResult(prisma, interaction.guildId, interaction.user.id, "vault", "loss", { now });
    else if (reward?.awarded) await recordGameResult(prisma, interaction.guildId, interaction.user.id, "vault", "win", { now });

    await interaction.reply(renderVault({ guess, challenge, won, reward, userId: interaction.user.id }));
  }
});
