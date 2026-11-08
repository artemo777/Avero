const GLOBAL_SCOPE_ID = "__avero_global__";

function memberKey(guildId, userId) {
  if (typeof guildId !== "string" || !/^\d{17,20}$/.test(guildId)) {
    throw new TypeError("A valid server ID is required.");
  }
  if (typeof userId !== "string" || !/^\d{17,20}$/.test(userId)) {
    throw new TypeError("A valid member ID is required.");
  }
  return { guildId: GLOBAL_SCOPE_ID, userId };
}

function requireAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000) {
    throw new RangeError("Amount must be an integer from 1 to 1,000,000.");
  }
}

function requireReason(reason) {
  if (reason !== undefined && reason !== null &&
      (typeof reason !== "string" || reason.trim().length > 200)) {
    throw new RangeError("Reason must be 200 characters or fewer.");
  }
  return reason?.trim() || null;
}

export async function adjustAdminInventory(prisma, guildId, targetUserId, actorUserId, itemId, operation, reason = null) {
  const key = memberKey(guildId, targetUserId);
  memberKey(guildId, actorUserId);
  if (typeof itemId !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(itemId)) {
    throw new TypeError("Item ID must be a valid shop identifier.");
  }
  if (!["grant", "remove"].includes(operation)) throw new TypeError("Choose grant or remove.");
  const cleanReason = requireReason(reason);
  return prisma.$transaction(async (tx) => {
    const composite = { ...key, itemId };
    const existing = await tx.currencyPurchase.findUnique({
      where: { guildId_userId_itemId: composite }
    });
    if (operation === "grant") {
      if (existing) return { updated: false, reason: "already_owned" };
      await tx.currencyPurchase.create({ data: { ...key, itemId } });
    } else {
      if (!existing) return { updated: false, reason: "not_owned" };
      await tx.currencyPurchase.delete({ where: { guildId_userId_itemId: composite } });
      const profile = await tx.memberProfile.findUnique({ where: { guildId_userId: key } });
      if (profile) {
        const changes = {};
        if (profile.equippedBadgeItemId === itemId) changes.equippedBadgeItemId = null;
        if (profile.equippedFrameItemId === itemId) changes.equippedFrameItemId = null;
        if (profile.equippedAvatarDecorationId === itemId) changes.equippedAvatarDecorationId = null;
        if (profile.profileShowcaseBadgeIds?.includes(itemId)) {
          changes.profileShowcaseBadgeIds = profile.profileShowcaseBadgeIds.filter((id) => id !== itemId);
        }
        if (Object.keys(changes).length) {
          await tx.memberProfile.update({ where: { guildId_userId: key }, data: changes });
        }
      }
    }
    await tx.adminEconomyAudit.create({
      data: { guildId, targetUserId, actorUserId, action: "item_" + operation, itemId, reason: cleanReason }
    });
    return { updated: true, itemId, operation };
  });
}

export async function recordAdminXpGrant(prisma, guildId, targetUserId, actorUserId, amount, reason = null) {
  memberKey(guildId, targetUserId);
  memberKey(guildId, actorUserId);
  requireAmount(amount);
  await prisma.adminEconomyAudit.create({
    data: {
      guildId, targetUserId, actorUserId, action: "xp_add",
      currency: "xp", amount, reason: requireReason(reason)
    }
  });
}
