/** Shared validation helpers for interactive game sessions.
 * Persistence, ownership checks, and reward transactions must still be enforced by callers.
 */
export const GAME_SESSION_MAX_AGE_MS = 15 * 60 * 1000;

export function validateGameSession(session, { guildId, userId, now = Date.now(), maxAgeMs = GAME_SESSION_MAX_AGE_MS } = {}) {
  if (!session || typeof session !== "object") throw new TypeError("A game session is required.");
  if (typeof session.id !== "string" || !session.id.length) throw new TypeError("Session id is invalid.");
  if (typeof session.guildId !== "string" || typeof session.userId !== "string") throw new TypeError("Session ownership is invalid.");
  if (typeof guildId !== "string" || typeof userId !== "string" || session.guildId !== guildId || session.userId !== userId) {
    return Object.freeze({ valid: false, reason: "owner" });
  }
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0) throw new RangeError("Invalid session timing.");
  if (!Number.isSafeInteger(session.createdAt) || session.createdAt > now || now - session.createdAt > maxAgeMs) {
    return Object.freeze({ valid: false, reason: "expired" });
  }
  if (session.completed === true) return Object.freeze({ valid: false, reason: "completed" });
  return Object.freeze({ valid: true, reason: null });
}

export function markSessionCompleted(session) {
  if (!session || typeof session !== "object" || session.completed === true) throw new Error("Session is missing or already completed.");
  return Object.freeze({ ...session, completed: true });
}
