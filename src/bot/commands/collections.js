import { MessageFlags } from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";
import { getCurrencyPurchases } from "../../db/currency-repository.js";
import { buildCollectionSetProgress } from "../collection-sets.js";

export const collectionsCommand = Object.freeze({
  data: Object.freeze({
    name: "collections",
    description: "Track themed collectible sets and their cosmetic titles.",
    options: [{
      type: 6,
      name: "member",
      description: "Member whose collection sets you want to inspect.",
      required: false
    }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Collections command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Avero collection sets are available inside a server.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const target = interaction.options.getUser("member") ?? interaction.user;
    const purchases = await getCurrencyPurchases(prisma, interaction.guildId, target.id);
    const sets = buildCollectionSetProgress(purchases.map((purchase) => purchase.itemId));
    const completed = sets.filter((set) => set.complete).length;
    const fields = sets.map((set) => ({
      name: (set.complete ? "✓ " : "◇ ") + set.icon + " " + set.name + " · " + set.ownedCount + "/" + set.totalCount,
      value: set.description + "\n**Expedition:** " + set.route +
        "\n**Items:** " + set.items.map((item) => (item.owned ? "✓ " : "◇ ") + item.name).join(" · ") +
        "\n**Set title:** " + set.title + (set.complete ? " · Unlocked" : " · " + set.progress + "% complete")
    }));

    await interaction.reply({
      allowedMentions: { parse: [] },
      embeds: [createEmbed({
        title: "🗺️ " + target.username + "'s Avero collections",
        description: "**" + completed + " / " + sets.length + " sets completed** · Collect through the shop or their matching expeditions.\nSet titles are cosmetic milestones; completing a set does not grant extra coins.",
        color: completed === sets.length ? THEME.colors.success : THEME.colors.primary,
        fields,
        footer: "COLLECTION ATLAS • PROGRESS SAVED PER SERVER"
      })]
    });
  }
});
