import { AttachmentBuilder, MessageFlags } from "discord.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createEmbed, getCollectibleAssetId, renderRegisteredAsset, THEME } from "../../../averoui/index.js";
import { getCurrencyAccount, getCurrencyPurchases } from "../../db/currency-repository.js";
import { getMemberProfile, levelForExperience, experienceForLevel } from "../../db/member-repository.js";
import { SHOP_ITEMS } from "../shop-catalog.js";

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
    const badgeItems = purchases.map((purchase) => SHOP_ITEMS.find((item) => item.id === purchase.itemId)).filter(Boolean);
    const badgeFilename = "profile-badges.png";
    let badgeFiles = [];
    if (badgeItems.length) {
      const badgeCanvas = createCanvas(96, 96);
      const ctx = badgeCanvas.getContext("2d");
      for (const [index, item] of badgeItems.slice(0, 6).entries()) {
        const asset = await renderRegisteredAsset(getCollectibleAssetId(item.id), 32);
        const image = await loadImage(asset);
        ctx.drawImage(image, (index % 3) * 32, Math.floor(index / 3) * 32, 32, 32);
      }
      badgeFiles = [new AttachmentBuilder(badgeCanvas.toBuffer("image/png"), { name: badgeFilename })];
    }
    const embed = createEmbed({
        ...(equippedItem ? {} : { title: target.username }),
        description: "AVERO  /  " + interaction.guild.name + "\nLevel **" + level + "** · " +
          (account?.balance ?? 0).toLocaleString("en-US") + " coins",
        color: THEME.colors.primary,
        fields: [
          { name: "🪙 Wallet", value: (account?.balance ?? 0).toLocaleString("en-US") + " coins", inline: true },
          { name: "✦ Level", value: String(level), inline: true },
          { name: "🎒 Collection", value: rarityCount + " / " + SHOP_ITEMS.length, inline: true },
          { name: "XP", value: (xp - currentLevelXp).toLocaleString("en-US") + " / " + (nextLevelXp - currentLevelXp).toLocaleString("en-US") + " to next level", inline: true },
          { name: "Badges", value: badgeItems.length ? badgeItems.map((item) => item.name).join(", ") : "None", inline: false }
        ]
      });
    if (badgeItems.length) {
      embed.author = { name: target.username, icon_url: "attachment://" + badgeFilename };
    }
    await interaction.reply({
      allowedMentions: { parse: [] },
      embeds: [embed],
      ...(badgeFiles.length ? { files: badgeFiles } : {})
    });
  }
});
