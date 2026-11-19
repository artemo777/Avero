import { randomUUID } from "node:crypto";

const SESSION_MAX_AGE_MS = 15 * 60 * 1000;
const validGameId = (id) => typeof id === "string" && /^[a-z][a-z0-9_]{0,39}$/.test(id);
function required(value, name) { if (typeof value !== "string" || !value.trim()) throw new TypeError(name + " is required."); return value.trim(); }
function validDate(now) { if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError("Invalid now."); }

export async function createGameSession(prisma, guildId, userId, gameId, payload, { now = new Date(), expiresInMs = SESSION_MAX_AGE_MS } = {}) {
  guildId = required(guildId, "guildId"); userId = required(userId, "userId");
  if (!validGameId(gameId)) throw new TypeError("Invalid gameId.");
  validDate(now);
  if (!Number.isSafeInteger(expiresInMs) || expiresInMs <= 0) throw new TypeError("Invalid session expiry.");
  const data = { id: randomUUID(), guildId, userId, gameId, status: "active", payload, createdAt: now, expiresAt: new Date(now.getTime() + expiresInMs) };
  if (typeof prisma.$transaction === "function") {
    return prisma.$transaction(async (tx) => {
      await tx.gameSession.updateMany({ where: { guildId, userId, gameId, status: "active" }, data: { status: "superseded" } });
      return tx.gameSession.create({ data });
    });
  }
  return prisma.gameSession.create({ data });
}

export async function getActiveGameSession(prisma, guildId, userId, sessionId, now = new Date()) {
  required(guildId, "guildId"); required(userId, "userId"); required(sessionId, "sessionId"); validDate(now);
  return prisma.gameSession.findFirst({ where: { id: sessionId, guildId, userId, status: "active", expiresAt: { gt: now } } });
}

/** Atomic compare-and-set; only one caller can claim a still-active session. */
export async function claimGameSession(prisma, guildId, userId, sessionId, { now = new Date() } = {}) {
  required(guildId, "guildId"); required(userId, "userId"); required(sessionId, "sessionId"); validDate(now);
  return prisma.gameSession.updateMany({
    where: { id: sessionId, guildId, userId, status: "active", expiresAt: { gt: now } },
    data: { status: "claimed", completedAt: now }
  });
}

export async function completeGameSession(prisma, guildId, userId, sessionId, { now = new Date() } = {}) {
  required(guildId, "guildId"); required(userId, "userId"); required(sessionId, "sessionId"); validDate(now);
  return prisma.gameSession.updateMany({ where: { id: sessionId, guildId, userId, status: "active", expiresAt: { gt: now } }, data: { status: "completed", completedAt: now } });
}

export async function expireGameSessions(prisma, now = new Date()) {
  validDate(now);
  return prisma.gameSession.updateMany({ where: { status: "active", expiresAt: { lte: now } }, data: { status: "expired" } });
}
