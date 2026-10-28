import { AttachmentBuilder, MessageFlags } from "discord.js";
import { createEmbed, THEME } from "../../../averoui/index.js";
import { getCurrencyAccount, getCurrencyPurchases } from "../../db/currency-repository.js";
import { getMemberProfile, levelForExperience, experienceForLevel } from "../../db/member-repository.js";
import { SHOP_ITEMS } from "../shop-catalog.js";
import { renderRegisteredAsset } from "../../../averoui/render-asset.js";
import { getCollectibleAssetId } from "../../../averoui/assets.js";

export const profileCommand = Object.freeze({
  data: Object.freeze({
    name: "profile",
    description: "View your or another member's Avero profile.",
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
    const [account, purchases, profile] = await Promise.all([
      getCurrencyAccount(prisma, interaction.guildId, target.id),
      getCurrencyPurchases(prisma, interaction.guildId, target.id),
      getMemberProfile(prisma, interaction.guildId, target.id)
    ]);
    const xp = profile?.xp ?? 0;
    const level = levelForExperience(xp);
    const currentLevelXp = experienceForLevel(level);
    const nextLevelXp = experienceForLevel(level + 1);
    const owned = new Set(purchases.map((purchase) => purchase.itemId));
    const rarityCount = SHOP_ITEMS.filter((item) => owned.has(item.id)).length;
    const equippedItem = SHOP_ITEMS.find((item) => item.id === profile?.equippedBadgeItemId && owned.has(item.id));
    const artworkFilename = equippedItem ? "avero-equipped-badge.png" : "avero-brand.png";
    const profileArtwork = await renderRegisteredAsset(equippedItem ? getCollectibleAssetId(equippedItem.id) : "brand-mark-svg", 256);
    await interaction.reply({
      files: [new AttachmentBuilder(profileArtwork, { name: artworkFilename })],
      embeds: [createEmbed({
        title: "✦ " + target.username,
        description: "Avero profile · " + interaction.guild.name,
        color: THEME.colors.primary,
        thumbnail: "attachment://" + artworkFilename,
        fields: [
          { name: "🪙 Wallet", value: (account?.balance ?? 0).toLocaleString("en-US") + " coins", inline: true },
          { name: "🏅 Level", value: String(level), inline: true },
          { name: "🎒 Collection", value: rarityCount + " / " + SHOP_ITEMS.length, inline: true },
          { name: "🏅 Equipped badge", value: equippedItem ? equippedItem.name : "No badge equipped", inline: true },
          { name: "XP progress", value: (xp - currentLevelXp).toLocaleString("en-US") + " / " + (nextLevelXp - currentLevelXp).toLocaleString("en-US") + " XP to level " + (level + 1) },
          { name: "Member", value: "<@" + target.id + ">", inline: true }
        ],
        footer: "AVERO • SERVER PROFILE"
      })]
    });
  }
});
