/** Non-combat tower challenge progression utilities. */
export const TOWER_MAX_FLOOR = 100;
export function validateFloor(floor) {
  if (!Number.isSafeInteger(floor) || floor < 1 || floor > TOWER_MAX_FLOOR) throw new RangeError("Invalid tower floor.");
  return floor;
}
export function checkpointForFloor(floor) {
  validateFloor(floor);
  return Math.floor((floor - 1) / 5) * 5 + 1;
}
export function chooseTowerPath(paths, choice) {
  if (!Array.isArray(paths) || paths.length < 2 || paths.length > 3 ||
      Array.from({ length: paths.length }, (_, index) => paths[index]).some((path, index) => !Object.hasOwn(paths, index) || typeof path !== "string" || !path.trim()) ||
      !Number.isSafeInteger(choice) || choice < 0 || choice >= paths.length) throw new TypeError("Invalid tower choice.");
  return paths[choice];
}
