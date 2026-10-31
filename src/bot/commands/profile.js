import { AttachmentBuilder, MessageFlags } from "discord.js";
import { createEmbed, getCollectibleAssetId, renderRegisteredAsset, THEME } from "../../../averoui/index.js";
import { getCurrencyAccount, getCurrencyPurchases, getCurrencyStats } from "../../db/currency-repository.js";
import { getMemberProfile } from "../../db/member-repository.js";
import { SHOP_ITEMS } from "../shop-catalog.js";
import { buildCollectionSetProgress } from "../collection-sets.js";
import { getArcadeMastery } from "../arcade-mastery.js";
import { TITLE_CATALOG } from "../title-catalog.js";

export const profileCommand = Object.freeze({
  data: Object.freeze({
    name: "profile",
    description: "Check your profile or another member's.",
    options: [{
      type: 6,
      name: "member",
      description: "Member profile to view.",
      required: false
    }]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Profile command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Profiles are available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const target = interaction.options.getUser("member") ?? interaction.user;
    const [account, purchases, profile, stats] = await Promise.all([
      getCurrencyAccount(prisma, interaction.guildId, target.id),
      getCurrencyPurchases(prisma, interaction.guildId, target.id),
      getMemberProfile(prisma, interaction.guildId, target.id),
      getCurrencyStats(prisma, interaction.guildId, target.id)
    ]);
    const owned = new Set(purchases.map((purchase) => purchase.itemId));
    const rarityCount = SHOP_ITEMS.filter((item) => owned.has(item.id)).length;
    const completedCollectionSets = buildCollectionSetProgress([...owned]).filter((set) => set.complete);
    const completedSets = completedCollectionSets.length;
    const collectionTitles = completedCollectionSets.map((set) => set.title);
    const arcadeMastery = getArcadeMastery(stats).map((game) =>
      game.tier + " " + game.name + " · " + game.wins + " wins" +
      (game.progress ? " · " + game.progress.current + "/" + game.progress.required + " to " + game.nextTier : " · Max tier")
    ).join("\n");
    const badgeItems = purchases.map((purchase) => SHOP_ITEMS.find((item) => item.id === purchase.itemId)).filter(Boolean);
    const equippedBadge = SHOP_ITEMS.find((item) => item.id === profile?.equippedBadgeItemId && owned.has(item.id));
    const equippedTitle = TITLE_CATALOG.find((title) => title.id === profile?.equippedTitleId);
    const badgeFilename = "profile-badge.png";
    let badgeFiles = [];
    if (equippedBadge) {
      const asset = await renderRegisteredAsset(getCollectibleAssetId(equippedBadge.id), 96);
      badgeFiles = [new AttachmentBuilder(asset, { name: badgeFilename })];
    }
    const embed = createEmbed({
        ...(equippedBadge ? {} : { title: target.username }),
        description: "Avero profile",
        color: THEME.colors.primary,
        fields: [
          { name: "🪙 Wallet", value: (account?.balance ?? 0).toLocaleString("en-US") + " coins", inline: true },
          { name: "🎒 Collection", value: rarityCount + " / " + SHOP_ITEMS.length, inline: true },
          { name: "🗺️ Collection sets", value: completedSets + " / 3 complete", inline: true },
          { name: "🏷️ Set titles", value: collectionTitles.length ? collectionTitles.join(", ") : "None unlocked", inline: false },
          { name: "🎮 Games record", value: stats.gamesPlayed ? stats.gameWins + "W / " + stats.gameLosses + "L / " + stats.gameTies + "T (" + Math.round(stats.gameWins / stats.gamesPlayed * 100) + "% win rate)" : "No games yet", inline: true },
          { name: "🎯 Games played", value: String(stats.gamesPlayed), inline: true },
          { name: "🏅 Arcade mastery", value: arcadeMastery, inline: false },
          { name: "🪙 Coins earned", value: stats.lifetimeEarned.toLocaleString("en-US"), inline: true },
          { name: "🛍️ Items bought", value: String(stats.itemsPurchased), inline: true },
          { name: "📆 Daily claims", value: String(stats.dailyClaims), inline: true },
          { name: "🧰 Work shifts", value: String(stats.workShifts), inline: true },
          { name: "🔎 Scavenges", value: String(stats.scavenges), inline: true },
          { name: "Coins spent", value: stats.lifetimeSpent.toLocaleString("en-US"), inline: true },
          { name: "Profile title", value: equippedTitle?.name ?? "None", inline: true },
          { name: "Equipped badge", value: equippedBadge?.name ?? "None", inline: true },
          { name: "Badges", value: badgeItems.length ? badgeItems.map((item) => item.name).join(", ") : "None", inline: false }
        ]
      });
    if (equippedBadge) {
      embed.author = { name: target.username, icon_url: "attachment://" + badgeFilename };
    }
    await interaction.reply({
      allowedMentions: { parse: [] },
      embeds: [embed],
      ...(badgeFiles.length ? { files: badgeFiles } : {})
    });
  }
});
