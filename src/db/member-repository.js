const GLOBAL_SCOPE_ID = "__avero_global__";

function requireIdentifier(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(name + " must be a non-empty string.");
  }
  return value.trim();
}

function memberWhere(guildId, userId) {
  requireIdentifier(guildId, "guildId");
  return {
    guildId_userId: {
      guildId: GLOBAL_SCOPE_ID,
      userId: requireIdentifier(userId, "userId")
    }
  };
}

export async function getMemberProfile(prisma, guildId, userId) {
  return prisma.memberProfile.findUnique({
    where: memberWhere(guildId, userId)
  });
}

export async function ensureMemberProfile(prisma, guildId, userId) {
  const key = memberWhere(guildId, userId).guildId_userId;
  return prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: key,
    update: {}
  });
}

export async function equipProfileBadge(prisma, guildId, userId, itemId) {
  const key = memberWhere(guildId, userId).guildId_userId;
  if (typeof itemId !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(itemId)) {
    throw new TypeError("Badge item ID must be a simple lowercase identifier.");
  }
  const owned = await prisma.currencyPurchase.findUnique({
    where: { guildId_userId_itemId: { ...key, itemId } }
  });
  if (!owned) return { equipped: false, reason: "not_owned" };
  const profile = await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: { ...key, equippedBadgeItemId: itemId },
    update: { equippedBadgeItemId: itemId }
  });
  return { equipped: true, profile };
}

const PROFILE_FRAME_ITEM_IDS = new Set([
  "aurora_frame", "nebula_cape", "moonlit_token", "prism_crown", "pixel_cape",
  "cloud_specs", "comet_trail", "mossy_mug", "paper_crown"
]);

export async function equipProfileFrame(prisma, guildId, userId, itemId) {
  const key = memberWhere(guildId, userId).guildId_userId;
  if (!PROFILE_FRAME_ITEM_IDS.has(itemId)) throw new TypeError("That collectible cannot be used as a profile frame.");
  const owned = await prisma.currencyPurchase.findUnique({
    where: { guildId_userId_itemId: { ...key, itemId } }
  });
  if (!owned) return { equipped: false, reason: "not_owned" };
  const profile = await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: { ...key, equippedFrameItemId: itemId },
    update: { equippedFrameItemId: itemId }
  });
  return { equipped: true, profile };
}

export async function unequipProfileFrame(prisma, guildId, userId) {
  const key = memberWhere(guildId, userId).guildId_userId;
  const profile = await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: key,
    update: { equippedFrameItemId: null }
  });
  return { unequipped: true, profile };
}

export async function unequipProfileBadge(prisma, guildId, userId) {
  const key = memberWhere(guildId, userId).guildId_userId;
  const profile = await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: key,
    update: { equippedBadgeItemId: null }
  });
  return { unequipped: true, profile };
}
