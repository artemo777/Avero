/** Timestamp-based crop growth helpers; persistence and harvest transactions are external. */
export const CROPS = Object.freeze({
  turnip: Object.freeze({ growthMs: 60_000, yield: 2 }),
  berry: Object.freeze({ growthMs: 300_000, yield: 3 }),
  pumpkin: Object.freeze({ growthMs: 900_000, yield: 4 })
});
export function cropStatus({ cropId, plantedAt, now }) {
  const crop = typeof cropId === "string" && Object.hasOwn(CROPS, cropId) ? CROPS[cropId] : null;
  if (!crop || !(plantedAt instanceof Date) || Number.isNaN(plantedAt.getTime()) ||
      !(now instanceof Date) || Number.isNaN(now.getTime()) || now < plantedAt) throw new TypeError("Invalid crop state.");
  const remainingMs = Math.max(0, crop.growthMs - (now.getTime() - plantedAt.getTime()));
  return Object.freeze({ ready: remainingMs === 0, remainingMs, yield: remainingMs === 0 ? crop.yield : 0 });
}
