import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { renderBalance, renderInventory, renderItemDetails, renderShop } from "../src/bot/game-ui.js";
import { getCollectibleAssetId, listAssets } from "../averoui/assets.js";
import { SHOP_ITEMS } from "../src/bot/shop-catalog.js";

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
  return json.components.flatMap((component) => component.type === 10 ? [component.content] :
    component.type === 9 ? component.components.filter((part) => part.type === 10).map((part) => part.content) : []
  ).join("\n");
}
function buttons(json) {
  return json.components.filter((component) => component.type === 1).flatMap((row) => row.components);
}

test("inventory uses the compact Components V2 layout and exposes item details", async () => {
  const response = await renderInventory(fakePrisma(["neon_badge", "vault_badge"]), "guild-1", "user-1");
  const json = panel(response);
  assert.match(allText(json), /Total Market Value/);
  assert.match(allText(json), /Page Market Value/);
  assert.match(allText(json), /2\/41/);
  assert.equal(json.components.filter((component) => component.type === 14).length, 2);
  const itemButtons = buttons(json).filter((entry) => entry.custom_id.startsWith("avero|user-1|item|"));
  assert.equal(itemButtons.length, 2);
  assert.ok(itemButtons.some((entry) => entry.custom_id.includes("neon_badge:0")));
  const ids = buttons(json).map((entry) => entry.custom_id);
  assert.equal(new Set(ids).size, ids.length, "inventory must never send duplicate component custom IDs");
});

test("inventory paginates at five items and shows compact navigation", async () => {
  const response = await renderInventory(fakePrisma([
    "neon_badge", "vault_badge", "starlight_badge", "moonlit_token", "prism_crown", "avero_relic"
  ]), "guild-1", "user-1");
  const json = panel(response);
  assert.equal(buttons(json).filter((entry) => entry.custom_id.startsWith("avero|user-1|item|")).length, 5);
  assert.match(allText(json), /PAGE 1 OF 2/);
  assert.ok(buttons(json).some((entry) => entry.custom_id === "avero|user-1|collection_next|1"));
  assert.ok(buttons(json).some((entry) => entry.custom_id === "avero|user-1|collection_first|0"));
  const ids = buttons(json).map((entry) => entry.custom_id);
  assert.equal(new Set(ids).size, ids.length, "inventory must never send duplicate component custom IDs");

  const laterPage = panel(await renderInventory(fakePrisma([
    "neon_badge", "vault_badge", "starlight_badge", "moonlit_token", "prism_crown", "avero_relic"
  ]), "guild-1", "user-1", 1));
  assert.match(allText(laterPage), /PAGE 2 OF 2/);
  const laterIds = buttons(laterPage).map((entry) => entry.custom_id);
  assert.equal(laterIds.filter((id) => id.startsWith("avero|user-1|item|")).length, 1);
  assert.equal(new Set(laterIds).size, laterIds.length, "later inventory pages must never send duplicate component custom IDs");
});

test("item detail shows owned state and does not offer a second purchase", async () => {
  const response = await renderItemDetails(fakePrisma(["neon_badge"]), "guild-1", "user-1", "neon_badge", 0);
  const json = panel(response);
  assert.match(allText(json), /Avero Enamel Pin/);
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
  const categoryRow = json.components.find((component) => component.type === 1 && component.components.some((child) => child.type === 3));
  assert.ok(categoryRow, "shop must show a category selection menu");
  assert.equal(categoryRow.components[0].placeholder, "Browse shop categories");
  assert.deepEqual(categoryRow.components[0].options.map((option) => option.value), ["all", "featured", "cosmetics", "badges", "tools", "coins", "gems"]);
  assert.ok(response.files.every((file) => file.name.startsWith("avero-collectible-") && file.name.endsWith(".png")));
  assert.ok(buttons(json).some((entry) => entry.custom_id === "avero|user-1|item|vault_badge:0:shop"));
  assert.ok(buttons(json).find((entry) => entry.custom_id === "avero|user-1|buy|neon_badge").disabled);
  assert.equal(new Set(componentIds).size, componentIds.length, "shop must never send duplicate component custom IDs");
  assert.ok(json.components.every((component) => component.type !== 12));
  assert.ok(json.components.length <= 10, "shop panel must stay within Discord container component limits");
  assert.match(allText(json), /VIRTUAL ITEMS ONLY/);
  assert.ok(buttons(json).some((entry) => entry.custom_id === "avero|user-1|shop_page|all:1"));

  const secondPage = panel(await renderShop(fakePrisma(["neon_badge"]), "guild-1", "user-1", 1));
  assert.equal(secondPage.components.filter((component) => component.type === 9).length, 3);
  assert.equal(buttons(secondPage).filter((entry) => entry.custom_id.startsWith("avero|user-1|buy|")).length, 3);
  assert.ok(buttons(secondPage).some((entry) => entry.custom_id === "avero|user-1|item|moonlit_token:1:shop"));
  assert.ok(secondPage.components.length <= 10);

  const detail = panel(await renderItemDetails(fakePrisma([]), "guild-1", "user-1", "vault_badge", 0, "shop"));
  assert.ok(buttons(detail).some((entry) => entry.custom_id === "avero|user-1|shop"));
  assert.ok(!detail.components.some((component) => component.type === 12));
});

test("inventory displays catalog values and compact separators", async () => {
  const response = await renderInventory(fakePrisma(["neon_badge", "vault_badge"]), "guild-1", "user-1");
  const json = panel(response);
  assert.match(allText(json), /Total Market Value:\*\* 450/);
  assert.match(allText(json), /Page Market Value:\*\* 450/);
  assert.ok(json.components.some((component) => component.type === 14));
});

test("balance uses the same compact V2 container style", async () => {
  const response = await renderBalance(fakePrisma([], 117355), "guild-1", "user-1");
  const json = panel(response);
  assert.match(allText(json), /117,355/);
  assert.match(allText(json), /Earn coins/);
  assert.equal(json.components.filter((component) => component.type === 14).length, 2);
});
test("gem shop category filters gem-priced items and shows a separate gem balance", async () => {
  const response = await renderShop({
    ...fakePrisma([]),
    currencyAccount: { findUnique: async () => ({ balance: 1200, gemBalance: 7 }) }
  }, "guild-1", "user-1", 0, "gems");
  const json = panel(response);
  assert.match(allText(json), /\*\*7\*\* gems/);
  assert.match(allText(json), /Aurora Frame/);
  assert.doesNotMatch(allText(json), /Avero Enamel Pin/);
  const ids = buttons(json).map((entry) => entry.custom_id);
  assert.equal(new Set(ids).size, ids.length);
});

test("registered asset IDs are unique", () => {
  const ids = listAssets().map((asset) => asset.id);
  assert.equal(new Set(ids).size, ids.length, "each registered asset must have a unique ID");
});


test("shop catalogue entries resolve to local product artwork", () => {
  for (const item of SHOP_ITEMS) {
    assert.ok(getCollectibleAssetId(item.id, item.category), item.id + " has a category artwork fallback");
  }
  assert.equal(getCollectibleAssetId("neon_badge"), "collectible-neon-badge");
  assert.equal(getCollectibleAssetId("other_badge", "badges"), "collectible-neon-badge");
  assert.equal(getCollectibleAssetId("other_cosmetic", "cosmetics"), "collectible-prism-crown");
  assert.equal(getCollectibleAssetId("other_tool", "tools"), "collectible-vault-badge");
  assert.equal(getCollectibleAssetId("other_coin", "coins"), "coin");
});
