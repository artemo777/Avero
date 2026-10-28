import { randomInt } from "node:crypto";
import { createEmbed, ICONS, THEME } from "../../../averoui/index.js";
import { playCoinflip } from "../../db/currency-repository.js";

const SIDES = Object.freeze(["heads", "tails"]);

export const coinflipCommand = Object.freeze({
  data: Object.freeze({
    name: "coinflip",
    description: "Wager virtual Avero coins on heads or tails.",
    options: [
      {
        type: 4,
        name: "wager",
        description: "Number of coins to wager (1–100000).",
        required: true,
        min_value: 1,
        max_value: 100000
      },
      {
        type: 3,
        name: "side",
        description: "Pick heads or tails.",
        required: true,
        choices: [
          { name: "Heads", value: "heads" },
          { name: "Tails", value: "tails" }
        ]
      }
    ]
  }),

  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Coinflip command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Currency can only be used inside a server.", ephemeral: true });
      return;
    }

    const wager = interaction.options.getInteger("wager", true);
    const chosenSide = interaction.options.getString("side", true);
    if (!Number.isSafeInteger(wager) || wager < 1 || wager > 100000 || !SIDES.includes(chosenSide)) {
      await interaction.reply({ content: "Choose a valid side and a wager from 1 to 100,000 coins.", ephemeral: true });
      return;
    }

    const resultSide = SIDES[randomInt(0, SIDES.length)];
    const won = resultSide === chosenSide;
    const result = await playCoinflip(prisma, interaction.guildId, interaction.user.id, wager, won);

    if (!result.played) {
      await interaction.reply({
        embeds: [createEmbed({
          title: ICONS.warning + "  Not enough coins",
          description: "Your balance is **" + (result.account?.balance ?? 0).toLocaleString("en-US") +
            " coins**. Claim `/daily` or choose a smaller wager.",
          color: THEME.colors.warning,
          footer: "Avero • Virtual coins only"
        })],
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      embeds: [createEmbed({
        title: (won ? ICONS.success : ICONS.info) + "  Coinflip: " + resultSide,
        description: [
          "You picked **" + chosenSide + "**.",
          won ? "You won **" + wager.toLocaleString("en-US") + " coins**!" : "You lost **" + wager.toLocaleString("en-US") + " coins**.",
          "New balance: **" + result.account.balance.toLocaleString("en-US") + " coins**."
        ].join("\n"),
        color: won ? THEME.colors.success : THEME.colors.primary,
        footer: "Avero • Virtual coins only"
      })],
      ephemeral: true
    });
  }
});
