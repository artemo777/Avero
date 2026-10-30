import { MessageFlags } from "discord.js";
import { awardGameReward, recordGameResult } from "../../db/currency-repository.js";
import { renderVault } from "../game-ui.js";
import { createVaultChallenge } from "../vault-puzzle.js";
import { GUESS_REWARD, GUESS_REWARD_COOLDOWN_MS } from "../economy-rules.js";

export const vaultCommand = Object.freeze({
  data: Object.freeze({
    name: "vault",
    description: "Crack your server's daily three-dial puzzle. Free to play; wins can earn 25 coins.",
    options: [{
      type: 3,
      name: "code",
      description: "Enter the three digits from the daily clues.",
      required: true,
      min_length: 3,
      max_length: 3
    }]
  }),
  async execute(interaction, { prisma, now = new Date() } = {}) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "The Vault is available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!prisma) throw new Error("Vault command requires a database client.");
    const guess = interaction.options.getString("code", true);
    if (!/^\d{3}$/.test(guess)) {
      await interaction.reply({ content: "Enter exactly three digits (000–999).", flags: MessageFlags.Ephemeral });
      return;
    }

    const challenge = createVaultChallenge(interaction.guildId, now);
    const won = guess === challenge.code;
    await recordGameResult(prisma, interaction.guildId, interaction.user.id, "vault", won ? "win" : "loss", { now });
    const reward = won
      ? await awardGameReward(prisma, interaction.guildId, interaction.user.id, GUESS_REWARD, {
        type: "vault_reward",
        cooldownMs: GUESS_REWARD_COOLDOWN_MS,
        now
      })
      : null;

    await interaction.reply(renderVault({ guess, challenge, won, reward, userId: interaction.user.id }));
  }
});
