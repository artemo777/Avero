function requireIdentifier(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(name + " must be a non-empty string.");
  }
  return value.trim();
}

function memberWhere(guildId, userId) {
  return {
    guildId_userId: {
      guildId: requireIdentifier(guildId, "guildId"),
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

export async function unequipProfileBadge(prisma, guildId, userId) {
  const key = memberWhere(guildId, userId).guildId_userId;
  const profile = await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: key,
    update: { equippedBadgeItemId: null }
  });
  return { unequipped: true, profile };
}
