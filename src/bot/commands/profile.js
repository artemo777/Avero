import { AttachmentBuilder, MessageFlags } from "discord.js";
import { getCollectibleAssetId, renderRegisteredAsset } from "../../../averoui/index.js";
import { createGamePanel, gamePayload } from "../game-ui.js";
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
    const sections = [
      "**🪙 Wallet** · " + (account?.balance ?? 0).toLocaleString("en-US") + " coins\n**🎒 Collection** · " + rarityCount + " / " + SHOP_ITEMS.length + "\n**🗺️ Sets** · " + completedSets + " / 3 complete",
      "**🏷️ Set titles**\n" + (collectionTitles.length ? collectionTitles.join(", ") : "None unlocked") + "\n**Profile title** · " + (equippedTitle?.name ?? "None") + "\n**Equipped badge** · " + (equippedBadge?.name ?? "None"),
      "**🎮 Games record** · " + (stats.gamesPlayed ? stats.gameWins + "W / " + stats.gameLosses + "L / " + stats.gameTies + "T (" + Math.round(stats.gameWins / stats.gamesPlayed * 100) + "% win rate)" : "No games yet") + "\n**🎯 Games played** · " + stats.gamesPlayed + "\n**🏅 Arcade mastery**\n" + (arcadeMastery || "No mastery progress yet"),
      "**🪙 Coins earned** · " + stats.lifetimeEarned.toLocaleString("en-US") + "\n**🛍️ Items bought** · " + stats.itemsPurchased + "\n**📆 Daily claims** · " + stats.dailyClaims + "\n**🧰 Work shifts** · " + stats.workShifts + "\n**🔎 Scavenges** · " + stats.scavenges + "\n**Coins spent** · " + stats.lifetimeSpent.toLocaleString("en-US"),
      "**Badges**\n" + (badgeItems.length ? badgeItems.map((item) => item.name).join(", ") : "None")
    ];
    await interaction.reply({
      ...gamePayload(createGamePanel({
        title: target.username,
        eyebrow: "AVERO • PROFILE",
        description: "Server profile and activity",
        sections,
        sectionThumbnails: equippedBadge ? [badgeFilename] : [],
        footer: "PROFILE • GLOBAL STATS",
        separators: true
      }), badgeFiles),
      allowedMentions: { parse: [] }
    });
  }
});
