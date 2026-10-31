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
    },
    memberProfile: {
      findUnique: async () => null
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
  assert.match(allText(json), /2 \/ 6 collectibles/);
  assert.equal(json.components.some((component) => component.type === 12), false);
  assert.equal(response.files, undefined);
  assert.match(allText(json), /Select an item below for its details/);
  const itemButtons = buttons(json).filter((entry) => entry.custom_id.startsWith("avero|user-1|item|"));
  assert.equal(itemButtons.length, 2);
  assert.ok(itemButtons.some((entry) => entry.custom_id.includes("neon_badge:0")));
});

test("inventory keeps up to seven collectibles on one compact page", async () => {
  const response = await renderInventory(fakePrisma([
    "neon_badge", "vault_badge", "starlight_badge", "moonlit_token", "prism_crown", "avero_relic"
  ]), "guild-1", "user-1");
  const json = panel(response);
  assert.equal(buttons(json).filter((entry) => entry.custom_id.startsWith("avero|user-1|item|")).length, 6);
  assert.doesNotMatch(allText(json), /page 1 of 2/i);
  assert.ok(!buttons(json).some((entry) => entry.custom_id.startsWith("avero|user-1|collection_page|")));
});

test("item detail shows owned state and does not offer a second purchase", async () => {
  const response = await renderItemDetails(fakePrisma(["neon_badge"]), "guild-1", "user-1", "neon_badge", 0);
  const json = panel(response);
  assert.match(allText(json), /Glitch Gremlin/);
  assert.match(allText(json), /In your collection/);
  assert.equal(json.components.some((component) => component.type === 12), false);
  assert.equal(response.files, undefined);
  assert.ok(!buttons(json).some((entry) => entry.custom_id === "avero|user-1|buy|neon_badge"));
});

test("unowned item detail offers a direct unlock action", async () => {
  const response = await renderItemDetails(fakePrisma([], 500), "guild-1", "user-1", "vault_badge", 0);
  const json = panel(response);
  assert.match(allText(json), /Not collected yet/);
  assert.match(allText(json), /300 coins/);
  assert.ok(buttons(json).some((entry) => entry.custom_id === "avero|user-1|buy|vault_badge"));
});

test("shop stays within Discord container limits across paginated item cards", async () => {
  const response = await renderShop(fakePrisma(["neon_badge"]), "guild-1", "user-1");
  const json = panel(response);
  const componentIds = buttons(json).map((entry) => entry.custom_id);
  assert.equal(componentIds.filter((id) => id.startsWith("avero|user-1|item|")).length, 3);
  assert.equal(componentIds.filter((id) => id.startsWith("avero|user-1|buy|")).length, 3);
  assert.equal(json.components.filter((component) => component.type === 9).length, 3);
  assert.equal(response.files.length, 3);
  assert.ok(response.files.every((file) => file.name.startsWith("avero-collectible-") && file.name.endsWith(".png")));
  assert.ok(buttons(json).some((entry) => entry.custom_id === "avero|user-1|item|vault_badge:0:shop"));
  assert.ok(buttons(json).find((entry) => entry.custom_id === "avero|user-1|buy|neon_badge").disabled);
  assert.equal(new Set(componentIds).size, componentIds.length, "shop must never send duplicate component custom IDs");
  assert.ok(json.components.every((component) => component.type !== 12));
  assert.ok(json.components.length <= 10, "shop panel must stay within Discord container component limits");
  assert.match(allText(json), /COLLECTIBLES • VIRTUAL ITEMS ONLY/);
  assert.ok(buttons(json).some((entry) => entry.custom_id === "avero|user-1|shop_page|1"));

  const secondPage = panel(await renderShop(fakePrisma(["neon_badge"]), "guild-1", "user-1", 1));
  assert.equal(secondPage.components.filter((component) => component.type === 9).length, 3);
  assert.equal(buttons(secondPage).filter((entry) => entry.custom_id.startsWith("avero|user-1|buy|")).length, 3);
  assert.ok(buttons(secondPage).some((entry) => entry.custom_id === "avero|user-1|item|avero_relic:1:shop"));
  assert.ok(secondPage.components.length <= 10);

  const detail = panel(await renderItemDetails(fakePrisma([]), "guild-1", "user-1", "vault_badge", 0, "shop"));
  assert.ok(buttons(detail).some((entry) => entry.custom_id === "avero|user-1|shop"));
  assert.ok(!detail.components.some((component) => component.type === 12));
});

test("collection shows earned and next milestones", async () => {
  const one = panel(await renderInventory(fakePrisma(["neon_badge"]), "guild-1", "user-1"));
  assert.match(allText(one), /First Find/);
  assert.match(allText(one), /Next: \*\*Curator\*\* — 1\/3 items/);

  const three = panel(await renderInventory(fakePrisma(["neon_badge", "vault_badge", "starlight_badge"]), "guild-1", "user-1"));
  assert.match(allText(three), /Curator/);
  assert.match(allText(three), /Next:.*Full Set.*3\/6 items/);

  const full = panel(await renderInventory(fakePrisma([
    "neon_badge", "vault_badge", "starlight_badge", "moonlit_token", "prism_crown", "avero_relic"
  ]), "guild-1", "user-1"));
  assert.match(allText(full), /All collection milestones complete/);
});
