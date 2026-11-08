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

function requireAmount(amount, { allowZero = false } = {}) {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(amount) || amount < minimum || amount > 1_000_000) {
    throw new RangeError("Amount must be an integer from " + minimum + " to 1,000,000.");
  }
}

function requireReason(reason) {
  if (reason !== undefined && reason !== null &&
      (typeof reason !== "string" || reason.trim().length > 200)) {
    throw new RangeError("Reason must be 200 characters or fewer.");
  }
  return reason?.trim() || null;
}

export async function adjustAdminCurrency(prisma, guildId, targetUserId, actorUserId, currency, operation, amount, reason = null) {
  const key = memberKey(guildId, targetUserId);
  memberKey(guildId, actorUserId);
  if (!["coins", "gems"].includes(currency)) throw new TypeError("Currency must be coins or gems.");
  if (!["add", "remove", "set"].includes(operation)) throw new TypeError("Choose add, remove, or set.");
  requireAmount(amount, { allowZero: operation === "set" });
  const cleanReason = requireReason(reason);
  return prisma.$transaction(async (tx) => {
    await tx.currencyAccount.upsert({
      where: { guildId_userId: key }, create: key, update: {}
    });
    const before = await tx.currencyAccount.findUnique({ where: { guildId_userId: key } });
    const field = currency === "gems" ? "gemBalance" : "balance";
    const previous = before?.[field] ?? 0;
    const next = operation === "set" ? amount : operation === "add" ? previous + amount : previous - amount;
    if (next < 0) return { updated: false, reason: "insufficient_balance", previous, next: previous };
    if (!Number.isSafeInteger(next) || next > 2_000_000_000) {
      throw new RangeError("The resulting balance would be outside the supported range.");
    }
    const delta = next - previous;
    await tx.currencyAccount.update({
      where: { guildId_userId: key }, data: { [field]: next }
    });
    await tx.currencyTransaction.create({
      data: { ...key, amount: delta, currency, type: "admin_adjustment", createdAt: new Date() }
    });
    await tx.adminEconomyAudit.create({
      data: {
        guildId, targetUserId, actorUserId,
        action: "currency_" + operation, currency, amount: delta, reason: cleanReason
      }
    });
    return { updated: true, currency, previous, balance: next, delta };
  });
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
