import test from "node:test";
import assert from "node:assert/strict";
import { COLLECTION_SETS, buildCollectionSetProgress } from "../src/bot/collection-sets.js";
import { SCAVENGE_ROUTES } from "../src/bot/game-ui.js";

test("collection atlas defines three distinct themed expedition sets", () => {
  assert.deepEqual(COLLECTION_SETS.map((set) => set.id), [
    "archive-protocol", "neon-circuit", "moonlit-relics"
  ]);
  assert.equal(new Set(COLLECTION_SETS.map((set) => set.id)).size, 3);
  for (const set of COLLECTION_SETS) {
    assert.ok(set.name);
    assert.ok(set.route);
    assert.ok(set.title);
    assert.equal(set.itemIds.length, 3);
    assert.equal(new Set(set.itemIds).size, set.itemIds.length);
  }
});

test("collection progress is deduplicated and set completion is exact", () => {
  const progress = buildCollectionSetProgress([
    "neon_badge", "vault_badge", "avero_relic", "neon_badge"
  ]);
  const archive = progress.find((set) => set.id === "archive-protocol");
  const neon = progress.find((set) => set.id === "neon-circuit");
  const moonlit = progress.find((set) => set.id === "moonlit-relics");

  assert.equal(archive.complete, true);
  assert.equal(archive.ownedCount, 3);
  assert.equal(archive.progress, 100);
  assert.equal(neon.complete, false);
  assert.equal(neon.ownedCount, 1);
  assert.equal(neon.progress, 33);
  assert.equal(moonlit.complete, false);
  assert.equal(moonlit.ownedCount, 1);
  assert.ok(progress.every((set) => set.items.length === set.totalCount));
});


test("each themed set matches the collectible pool of its named expedition", () => {
  for (const set of COLLECTION_SETS) {
    const route = SCAVENGE_ROUTES.find((candidate) => candidate.name === set.route);
    assert.ok(route, "missing expedition route " + set.route);
    assert.deepEqual(
      [...route.items.map((item) => item.id)].sort(),
      [...set.itemIds].sort()
    );
  }
});
