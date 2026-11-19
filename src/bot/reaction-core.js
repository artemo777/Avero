/** Reaction game scoring. Inputs must be measured and validated by the server. */
export function evaluateReaction({ elapsedMs, windowMs }) {
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 5000 ||
      !Number.isSafeInteger(windowMs) || windowMs < 100 || windowMs > 1500) {
    throw new RangeError("Invalid reaction timing.");
  }
  if (elapsedMs > windowMs) return Object.freeze({ success: false, score: 0 });
  return Object.freeze({ success: true, score: Math.max(0, Math.round(100 * (1 - elapsedMs / windowMs))) });
}
