import { SHOP_ITEMS } from "./shop-catalog.js";

export const COLLECTION_SETS = Object.freeze([
  Object.freeze({
    id: "archive-protocol",
    name: "The Archive Protocol",
    route: "Old Server Archive",
    icon: "📚",
    title: "Archive Keeper",
    description: "Recover the lost records and preserve Avero's earliest relics.",
    itemIds: Object.freeze(["neon_badge", "vault_badge", "avero_relic"])
  }),
  Object.freeze({
    id: "neon-circuit",
    name: "Neon Circuit",
    route: "Neon Plaza",
    icon: "🌆",
    title: "Circuit Breaker",
    description: "Assemble the brightest artifacts from the city after dark.",
    itemIds: Object.freeze(["neon_badge", "starlight_badge", "prism_crown"])
  }),
  Object.freeze({
    id: "moonlit-relics",
    name: "Moonlit Relics",
    route: "Moonlit Garden",
    icon: "🌙",
    title: "Moonlit Curator",
    description: "Gather the rare keepsakes hidden along the lantern path.",
    itemIds: Object.freeze(["moonlit_token", "prism_crown", "avero_relic"])
  })
]);

const ITEM_BY_ID = new Map(SHOP_ITEMS.map((item) => [item.id, item]));

export function buildCollectionSetProgress(ownedItemIds) {
  const owned = new Set(ownedItemIds ?? []);
  return COLLECTION_SETS.map((set) => {
    const items = set.itemIds.map((id) => {
      const item = ITEM_BY_ID.get(id);
      if (!item) throw new Error("Collection set references unknown item: " + id);
      return { ...item, owned: owned.has(id) };
    });
    const ownedCount = items.filter((item) => item.owned).length;
    return {
      ...set,
      items,
      ownedCount,
      totalCount: items.length,
      complete: ownedCount === items.length,
      progress: Math.round((ownedCount / items.length) * 100)
    };
  });
}
