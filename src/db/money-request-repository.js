const GLOBAL_SCOPE_ID = "__avero_global__";
const MAX_ASK_AMOUNT = 10_000;
const REQUEST_LIFETIME_MS = 10 * 60 * 1000;

function requireMember(guildId, userId) {
  if (typeof guildId !== "string" || !guildId.trim() || typeof userId !== "string" || !userId.trim()) {
    throw new TypeError("A server and member are required.");
  }
  return { guildId: GLOBAL_SCOPE_ID, userId: userId.trim() };
}

export async function createMoneyRequest(prisma, guildId, requesterId, targetId, amount, { now = new Date() } = {}) {
  const requester = requireMember(guildId, requesterId);
  if (typeof targetId !== "string" || !targetId.trim()) throw new TypeError("Choose a server member.");
  if (targetId === requester.userId) throw new RangeError("You cannot request coins from yourself.");
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_ASK_AMOUNT) {
    throw new RangeError("Ask for between 1 and " + MAX_ASK_AMOUNT + " virtual coins.");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError("now must be a valid Date.");
  return prisma.moneyRequest.create({
    data: {
      guildId: guildId.trim(), requesterId: requester.userId, targetId: targetId.trim(),
      amount, expiresAt: new Date(now.getTime() + REQUEST_LIFETIME_MS), createdAt: now
    }
  });
}

export async function respondToMoneyRequest(prisma, guildId, requestId, responderId, decision, { now = new Date() } = {}) {
  if (!["accept", "decline"].includes(decision)) throw new TypeError("Choose accept or decline.");
  if (typeof requestId !== "string" || !requestId.trim()) throw new TypeError("A request ID is required.");
  const serverId = guildId.trim();
  return prisma.$transaction(async (tx) => {
    const request = await tx.moneyRequest.findUnique({ where: { id: requestId } });
    if (!request || request.guildId !== serverId) return { completed: false, reason: "missing" };
    if (request.targetId !== responderId) return { completed: false, reason: "not_target" };
    if (request.status !== "pending") return { completed: false, reason: "handled" };
    if (request.expiresAt <= now) {
      const expired = await tx.moneyRequest.updateMany({
        where: { id: requestId, status: "pending", expiresAt: { lte: now } },
        data: { status: "expired", respondedAt: now }
      });
      return { completed: false, reason: expired.count === 1 ? "expired" : "handled" };
    }
    if (decision === "decline") {
      const declined = await tx.moneyRequest.updateMany({
        where: { id: requestId, status: "pending", expiresAt: { gt: now } },
        data: { status: "declined", respondedAt: now }
      });
      if (declined.count !== 1) return { completed: false, reason: "handled" };
      return { completed: true, accepted: false, request };
    }
    const payerKey = { guildId: GLOBAL_SCOPE_ID, userId: responderId };
    const receiverKey = { guildId: GLOBAL_SCOPE_ID, userId: request.requesterId };
    await tx.currencyAccount.upsert({ where: { guildId_userId: payerKey }, create: payerKey, update: {} });
    await tx.currencyAccount.upsert({ where: { guildId_userId: receiverKey }, create: receiverKey, update: {} });
    const debit = await tx.currencyAccount.updateMany({
      where: { ...payerKey, balance: { gte: request.amount } },
      data: { balance: { decrement: request.amount } }
    });
    if (debit.count !== 1) return { completed: false, reason: "insufficient_funds" };
    const claimed = await tx.moneyRequest.updateMany({
      where: { id: requestId, status: "pending", expiresAt: { gt: now } },
      data: { status: "accepted", respondedAt: now }
    });
    if (claimed.count !== 1) throw new Error("The request was already handled.");
    await tx.currencyAccount.updateMany({
      where: receiverKey,
      data: { balance: { increment: request.amount } }
    });
    await tx.currencyTransaction.createMany({
      data: [
        { ...payerKey, amount: -request.amount, currency: "coins", type: "ask_transfer_sent", createdAt: now },
        { ...receiverKey, amount: request.amount, currency: "coins", type: "ask_transfer_received", createdAt: now }
      ]
    });
    const [payer, receiver] = await Promise.all([
      tx.currencyAccount.findUnique({ where: { guildId_userId: payerKey } }),
      tx.currencyAccount.findUnique({ where: { guildId_userId: receiverKey } })
    ]);
    return { completed: true, accepted: true, request, payer, receiver };
  });
}
