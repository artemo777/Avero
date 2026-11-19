import { randomUUID } from "node:crypto";

const SESSION_MAX_AGE_MS = 15 * 60 * 1000;
const GLOBAL_SCOPE_ID = "__avero_global__";
const validGameId = (id) => typeof id === "string" && /^[a-z][a-z0-9_]{0,39}$/.test(id);
function required(value, name) { if (typeof value !== "string" || !value.trim()) throw new TypeError(name + " is required."); return value.trim(); }
function validDate(now) { if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError("Invalid now."); }

export async function createGameSession(prisma, guildId, userId, gameId, payload, { now = new Date(), expiresInMs = SESSION_MAX_AGE_MS } = {}) {
  guildId = required(guildId, "guildId"); userId = required(userId, "userId");
  if (!validGameId(gameId)) throw new TypeError("Invalid gameId.");
  validDate(now);
  if (!Number.isSafeInteger(expiresInMs) || expiresInMs <= 0) throw new TypeError("Invalid session expiry.");
  const expiresAt = new Date(now.getTime() + expiresInMs);
  if (Number.isNaN(expiresAt.getTime())) throw new TypeError("Session expiry is out of range.");
  const data = { id: randomUUID(), guildId, userId, gameId, status: "active", payload, createdAt: now, expiresAt };
  if (typeof prisma.$transaction === "function") {
    return prisma.$transaction(async (tx) => {
      await tx.gameSession.updateMany({ where: { status: "active", expiresAt: { lte: now } }, data: { status: "expired" } });
      await tx.gameSession.updateMany({ where: { guildId, userId, gameId, status: "active" }, data: { status: "superseded" } });
      return tx.gameSession.create({ data });
    });
  }
  await prisma.gameSession.updateMany({ where: { status: "active", expiresAt: { lte: now } }, data: { status: "expired" } });
  await prisma.gameSession.updateMany({ where: { guildId, userId, gameId, status: "active" }, data: { status: "superseded" } });
  return prisma.gameSession.create({ data });
}

export async function getActiveGameSession(prisma, guildId, userId, sessionId, now = new Date()) {
  required(guildId, "guildId"); required(userId, "userId"); required(sessionId, "sessionId"); validDate(now);
  return prisma.gameSession.findFirst({ where: { id: sessionId, guildId, userId, status: "active", expiresAt: { gt: now } } });
}

/** Atomically transitions an owned, unexpired session from active to claimed. */
export async function claimGameSession(prisma, guildId, userId, sessionId, { now = new Date() } = {}) {
  required(guildId, "guildId"); required(userId, "userId"); required(sessionId, "sessionId"); validDate(now);
  return prisma.gameSession.updateMany({
    where: { id: sessionId, guildId, userId, status: "active", expiresAt: { gt: now } },
    data: { status: "claimed", completedAt: now }
  });
}

/** Atomically consumes an active session and awards coins in the same transaction. */
export async function settleGameSessionReward(prisma, guildId, userId, sessionId, amount, {
  type = "game_reward", cooldownMs = 60_000, now = new Date()
} = {}) {
  guildId = required(guildId, "guildId"); userId = required(userId, "userId"); sessionId = required(sessionId, "sessionId");
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new TypeError("Reward amount must be a positive safe integer.");
  if (typeof type !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(type)) throw new TypeError("Invalid reward type.");
  if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 1) throw new TypeError("Invalid reward cooldown.");
  validDate(now);
  const cooldownCutoff = new Date(now.getTime() - cooldownMs);
  if (Number.isNaN(cooldownCutoff.getTime())) throw new TypeError("Cooldown window is out of range.");
  return prisma.$transaction(async (tx) => {
    const key = { guildId: GLOBAL_SCOPE_ID, userId };
    await tx.currencyAccount.upsert({ where: { guildId_userId: key }, create: key, update: {} });
    const sessionClaim = await tx.gameSession.updateMany({
      where: { id: sessionId, guildId, userId, status: "active", expiresAt: { gt: now } },
      data: { status: "claimed", completedAt: now }
    });
    if (sessionClaim.count !== 1) return { awarded: false, reason: "session_unavailable" };
    const accountClaim = await tx.currencyAccount.updateMany({
      where: { ...key, OR: [{ lastGameRewardAt: null }, { lastGameRewardAt: { lte: cooldownCutoff } }] },
      data: { balance: { increment: amount }, lastGameRewardAt: now }
    });
    if (accountClaim.count !== 1) {
      await tx.gameSession.updateMany({ where: { id: sessionId, guildId, userId, status: "claimed" }, data: { status: "active", completedAt: null } });
      return { awarded: false, reason: "cooldown" };
    }
    await tx.currencyTransaction.create({ data: { ...key, amount, type, createdAt: now } });
    const account = await tx.currencyAccount.findUnique({ where: { guildId_userId: key } });
    return { awarded: true, amount, account };
  });
}

export async function completeGameSession(prisma, guildId, userId, sessionId, { now = new Date() } = {}) {
  required(guildId, "guildId"); required(userId, "userId"); required(sessionId); validDate(now);
  return prisma.gameSession.updateMany({ where: { id: sessionId, guildId, userId, status: "active", expiresAt: { gt: now } }, data: { status: "completed", completedAt: now } });
}

export async function expireGameSessions(prisma, now = new Date()) {
  validDate(now);
  return prisma.gameSession.updateMany({ where: { status: "active", expiresAt: { lte: now } }, data: { status: "expired" } });
}
