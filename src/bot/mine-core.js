/** Pure, bounded mine-grid mechanics. Board construction and rewards remain server-owned. */
export const MINE_SIZE = 5;
export const MINE_TURNS = 5;
export const ORE_VALUES = Object.freeze({ coal: 2, iron: 5, gold: 10, crystal: 15 });

export function validateMineTile(tile) {
  if (!Number.isInteger(tile) || tile < 0 || tile >= MINE_SIZE * MINE_SIZE) {
    throw new RangeError("Tile must be a valid index in the 5x5 grid.");
  }
  return tile;
}
export function resolveMineTurn({ tile, revealed, oreByTile }) {
  validateMineTile(tile);
  if (!Array.isArray(revealed) || !Array.isArray(oreByTile) ||
      revealed.length !== MINE_SIZE * MINE_SIZE || oreByTile.length !== revealed.length) {
    throw new TypeError("Mine state is invalid.");
  }
  if (revealed[tile]) throw new Error("Tile already revealed.");
  const ore = oreByTile[tile];
  if (ore !== null && ore !== undefined && !Object.hasOwn(ORE_VALUES, ore)) throw new TypeError("Unknown ore.");
  const next = revealed.slice();
  next[tile] = true;
  return Object.freeze({ tile, ore: ore ?? null, value: ore ? ORE_VALUES[ore] : 0, revealed: next });
}
