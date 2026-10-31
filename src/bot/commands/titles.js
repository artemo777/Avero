import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";
import { getCurrencyAccount, getCurrencyPurchases, getCurrencyStats } from "../../db/currency-repository.js";
import { equipMemberTitle, getMemberTitles, purchaseMemberTitle, unlockMemberTitle } from "../../db/title-repository.js";
import { buildCollectionSetProgress } from "../collection-sets.js";
import { getEligibleMilestoneTitles, TITLE_CATALOG } from "../title-catalog.js";

function titleChoices() {
  return TITLE_CATALOG.map((title) => ({ name: title.name, value: title.id }));
}

async function syncMilestoneTitles(prisma, guildId, userId, stats, purchases) {
  const itemIds = [...new Set(purchases.map((purchase) => purchase.itemId))];
  const completedSets = buildCollectionSetProgress(itemIds).filter((set) => set.complete).length;
  const eligible = getEligibleMilestoneTitles(stats, completedSets);
  const results = await Promise.all(eligible.map((title) =>
    unlockMemberTitle(prisma, guildId, userId, title.id, "milestone")
  ));
  return results.filter((result) => result.unlocked).map((result) => result.title.titleId);
}

export async function renderTitlesPage(prisma, guildId, user, controlUserId, page = 0) {
  const [stats, purchases, account] = await Promise.all([
    getCurrencyStats(prisma, guildId, user.id),
    getCurrencyPurchases(prisma, guildId, user.id),
    getCurrencyAccount(prisma, guildId, user.id)
  ]);
  const milestoneStats = { ...stats, dailyStreak: account?.dailyStreak ?? 0 };
  const newlyUnlocked = await syncMilestoneTitles(prisma, guildId, user.id, milestoneStats, purchases);
  const [owned, profile] = await Promise.all([
    getMemberTitles(prisma, guildId, user.id),
    prisma.memberProfile.findUnique({
      where: { guildId_userId: { guildId: guildId, userId: user.id } }
    })
  ]);
  const ownedIds = new Set(owned.map((entry) => entry.titleId));
  const unlockedLines = TITLE_CATALOG.filter((title) => ownedIds.has(title.id))
    .map((title) => (profile?.equippedTitleId === title.id ? "▶ " : "• ") + "**" + title.name + "**" + (title.price ? " · shop" : " · earned"));
  const lockedLines = TITLE_CATALOG.filter((title) => !ownedIds.has(title.id))
    .map((title) => {
      if (title.price) return "◇ **" + title.name + "** · " + title.price.toLocaleString("en-US") + " coins";
      const current = title.unlock.stat === "completedSets" ? buildCollectionSetProgress([...new Set(purchases.map((purchase) => purchase.itemId))]).filter((set) => set.complete).length : (milestoneStats[title.unlock.stat] ?? 0);
      return "◇ **" + title.name + "** · " + Math.min(current, title.unlock.target) + "/" + title.unlock.target + " · " + title.description;
    });
  const allLines = TITLE_CATALOG.map((title) => {
    if (ownedIds.has(title.id)) return (profile?.equippedTitleId === title.id ? "▶ " : "• ") + "**" + title.name + "**" + (title.price ? " · shop" : " · earned");
    if (title.price) return "◇ **" + title.name + "** · " + title.price.toLocaleString("en-US") + " coins";
    const current = title.unlock.stat === "completedSets" ? buildCollectionSetProgress([...new Set(purchases.map((purchase) => purchase.itemId))]).filter((set) => set.complete).length : (milestoneStats[title.unlock.stat] ?? 0);
    return "◇ **" + title.name + "** · " + Math.min(current, title.unlock.target) + "/" + title.unlock.target + " · " + title.description;
  });
  const pageSize = 7;
  const pageCount = Math.max(1, Math.ceil(allLines.length / pageSize));
  const currentPage = Math.min(Math.max(Number.isInteger(page) ? page : 0, 0), pageCount - 1);
  const pageLines = allLines.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const description = [
    newlyUnlocked.length ? "✨ Just unlocked: " + newlyUnlocked.map((id) => TITLE_CATALOG.find((title) => title.id === id)?.name).filter(Boolean).join(", ") : null,
    "**Titles · owned and locked**",
    pageLines.join("\n")
  ].filter((line) => line !== null).join("\n");
  const components = pageCount > 1 ? [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("avero|" + controlUserId + "|titles_page|" + Math.max(0, currentPage - 1)).setLabel("← Previous").setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
    new ButtonBuilder().setCustomId("avero|" + controlUserId + "|titles_page|" + Math.min(pageCount - 1, currentPage + 1)).setLabel("Next →").setStyle(ButtonStyle.Secondary).setDisabled(currentPage === pageCount - 1)
  )] : [];
  return {
    embeds: [createEmbed({
      title: "🏷️ " + user.username + "'s titles",
      description,
      color: THEME.colors.primary,
      footer: "Use /titles action:buy or action:equip · server-specific · Page " + (currentPage + 1) + "/" + pageCount
    })],
    components
  };
}
\nexport const titlesCommand = Object.freeze({
  data: Object.freeze({
    name: "titles",
    description: "Unlock, buy and equip your Avero profile title.",
    options: [
      {
        type: 3,
        name: "action",
        description: "What do you want to do?",
        required: false,
        choices: [
          { name: "View titles", value: "view" },
          { name: "Buy a title", value: "buy" },
          { name: "Equip a title", value: "equip" },
          { name: "Remove equipped title", value: "unequip" }
        ]
      },
      {
        type: 3,
        name: "title",
        description: "Title to buy or equip.",
        required: false,
        choices: titleChoices()
      }
    ]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Titles command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Titles are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const action = interaction.options.getString("action") ?? "view";
    const titleId = interaction.options.getString("title");
    const selected = TITLE_CATALOG.find((title) => title.id === titleId);
    if (action !== "view" && action !== "unequip" && !selected) {
      await interaction.reply({ content: "Choose a title from the list.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === "buy") {
      if (!selected.price) {
        await interaction.reply({ content: "That title is earned through a milestone, not bought.", flags: MessageFlags.Ephemeral });
        return;
      }
      const result = await purchaseMemberTitle(prisma, interaction.guildId, interaction.user.id, selected.id, selected.price);
      const message = result.purchased
        ? "Unlocked **" + selected.name + "** for **" + selected.price.toLocaleString("en-US") + " coins**."
        : result.reason === "owned"
          ? "You already own **" + selected.name + "**."
          : "You need **" + selected.price.toLocaleString("en-US") + " coins**. Your balance is **" + (result.account?.balance ?? 0).toLocaleString("en-US") + "**.";
      await interaction.reply({
        embeds: [createEmbed({ title: "Title shop", description: message, color: result.purchased ? THEME.colors.success : THEME.colors.primary, footer: "Virtual coins only · no cash value" })],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (action === "equip") {
      const result = await equipMemberTitle(prisma, interaction.guildId, interaction.user.id, selected.id);
      await interaction.reply({
        content: result.equipped ? "Your profile title is now **" + selected.name + "**." : "Unlock that title before equipping it.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (action === "unequip") {
      await equipMemberTitle(prisma, interaction.guildId, interaction.user.id, null);
      await interaction.reply({ content: "Your profile title has been removed.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply(await renderTitlesPage(prisma, interaction.guildId, interaction.user, interaction.user.id));

  }
});
