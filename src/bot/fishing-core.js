/**
 * Deterministic, server-validated core for Avero's timing-based fishing game.
 * No wagers, random payouts, or currency writes occur in this module.
 */
export const FISHING_LIMITS = Object.freeze({
  minReactionMs: 0,
  maxReactionMs: 2_000,
  minTargetMs: 300,
  maxTargetMs: 900,
  maxCoins: 25
});

export function evaluateFishingAttempt({ reactionMs, targetMs }) {
  if (!Number.isSafeInteger(reactionMs) ||
      reactionMs < FISHING_LIMITS.minReactionMs ||
      reactionMs > FISHING_LIMITS.maxReactionMs) {
    throw new RangeError("reactionMs must be an integer between 0 and 2000.");
  }
  if (!Number.isSafeInteger(targetMs) ||
      targetMs < FISHING_LIMITS.minTargetMs ||
      targetMs > FISHING_LIMITS.maxTargetMs) {
    throw new RangeError("targetMs must be an integer between 300 and 900.");
  }

  // The target is a fixed timing threshold selected by the server before play.
  // Reward is bounded and entirely determined by validated input.
  const caught = reactionMs <= targetMs;
  if (!caught) return Object.freeze({ caught: false, score: 0, coins: 0, tier: "miss" });

  const margin = targetMs - reactionMs;
  const score = Math.max(1, Math.min(100, Math.round(100 - (margin / targetMs) * 50)));
  const coins = Math.min(FISHING_LIMITS.maxCoins, Math.max(5, Math.round(score / 4)));
  const tier = score >= 90 ? "excellent" : score >= 70 ? "great" : "caught";
  return Object.freeze({ caught: true, score, coins, tier });
}
