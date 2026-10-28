import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { renderInventory, renderItemDetails, renderShop } from "../src/bot/game-ui.js";

function fakePrisma(itemIds = [], balance = 800) {
  return {
    currencyPurchase: {
      findMany: async () => itemIds.map((itemId, index) => ({ itemId, purchasedAt: new Date(index) })),
      findUnique: async ({ where }) => itemIds.includes(where.guildId_userId_itemId.itemId)
        ? { itemId: where.guildId_userId_itemId.itemId } : null
    },
    currencyAccount: {
      findUnique: async () => ({ balance })
    }
  };
}
function panel(response) {
  assert.equal(response.flags, MessageFlags.IsComponentsV2);
  return response.components[0].toJSON();
}
function allText(json) {
  return json.components.filter((component) => component.type === 10).map((component) => component.content).join("\n");
}
function buttons(json) {
  return json.components.filter((component) => component.type === 1).flatMap((row) => row.components);
}

test("inventory exposes item detail buttons and collection progress", async () => {
  const response = await renderInventory(fakePrisma(["neon_badge", "vault_badge"]), "guild-1", "user-1");
  const json = panel(response);
  assert.match(allText(json), /2 \/ 6 starter collectibles/);
  assert.match(allText(json), /Select an item below for its details/);
  const itemButtons = buttons(json).filter((entry) => entry.custom_id.startsWith("avero|user-1|item|"));
  assert.equal(itemButtons.length, 2);
  assert.ok(itemButtons.some((entry) => entry.custom_id.includes("neon_badge:0")));
});

test("inventory pagination shows at most four collectibles and a next-page control", async () => {
  const response = await renderInventory(fakePrisma([
    "neon_badge", "vault_badge", "starlight_badge", "moonlit_token", "prism_crown", "avero_relic"
  ]), "guild-1", "user-1");
  const json = panel(response);
  assert.match(allText(json), /page 1 of 2/i);
  assert.equal(buttons(json).filter((entry) => entry.custom_id.startsWith("avero|user-1|item|")).length, 4);
  assert.ok(buttons(json).some((entry) => entry.custom_id === "avero|user-1|collection_page|1"));
});

test("item detail shows owned state and does not offer a second purchase", async () => {
  const response = await renderItemDetails(fakePrisma(["neon_badge"]), "guild-1", "user-1", "neon_badge", 0);
  const json = panel(response);
  assert.match(allText(json), /Neon Badge/);
  assert.match(allText(json), /In your collection/);
  assert.ok(!buttons(json).some((entry) => entry.custom_id === "avero|user-1|buy|neon_badge"));
});

test("unowned item detail offers a direct unlock action", async () => {
  const response = await renderItemDetails(fakePrisma([], 500), "guild-1", "user-1", "vault_badge", 0);
  const json = panel(response);
  assert.match(allText(json), /Not collected yet/);
  assert.match(allText(json), /300 coins/);
  assert.ok(buttons(json).some((entry) => entry.custom_id === "avero|user-1|buy|vault_badge"));
});

test("shop exposes item detail controls and item details return to the shop", async () => {
  const response = await renderShop(fakePrisma(["neon_badge"]), "guild-1", "user-1");
  const json = panel(response);
  assert.equal(buttons(json).filter((entry) => entry.custom_id.startsWith("avero|user-1|item|")).length, 6);
  assert.ok(buttons(json).some((entry) => entry.custom_id === "avero|user-1|item|vault_badge:0:shop"));

  const detail = panel(await renderItemDetails(fakePrisma([]), "guild-1", "user-1", "vault_badge", 0, "shop"));
  assert.ok(buttons(detail).some((entry) => entry.custom_id === "avero|user-1|shop"));
});

test("collection shows earned and next milestones", async () => {
  const one = panel(await renderInventory(fakePrisma(["neon_badge"]), "guild-1", "user-1"));
  assert.match(allText(one), /First Find/);
  assert.match(allText(one), /Next: Curator — 1\/3 items/);

  const three = panel(await renderInventory(fakePrisma(["neon_badge", "vault_badge", "starlight_badge"]), "guild-1", "user-1"));
  assert.match(allText(three), /Curator/);
  assert.match(allText(three), /Next: Full Set — 3\/6 items/);

  const full = panel(await renderInventory(fakePrisma([
    "neon_badge", "vault_badge", "starlight_badge", "moonlit_token", "prism_crown", "avero_relic"
  ]), "guild-1", "user-1"));
  assert.match(allText(full), /All collection milestones complete/);
});
