import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { getCurrencyPurchases, purchaseCurrencyItem } from "../src/db/currency-repository.js";
import { buyCommand } from "../src/bot/commands/buy.js";
import { shopCommand, SHOP_ITEMS } from "../src/bot/commands/shop.js";
import { inventoryCommand } from "../src/bot/commands/inventory.js";

function panelText(response) {
  return response.components[0].toJSON().components.filter((component) => component.type === 10).map((component) => component.content).join("\n");
}

function createFakePrisma(initialBalance = 0) {
  const accounts = new Map();
  const purchases = new Map();
  const transactions = [];
  const keyOf = (guildId, userId) => guildId + ":" + userId;
  const purchaseKey = (guildId, userId, itemId) => keyOf(guildId, userId) + ":" + itemId;
  const prisma = {
    accounts, purchases, transactions,
    $transaction: (callback) => callback(prisma),
    currencyAccount: {
      async upsert({ where, create }) {
        const key = keyOf(where.guildId_userId.guildId, where.guildId_userId.userId);
        if (!accounts.has(key)) accounts.set(key, { ...create, balance: initialBalance, lastDailyAt: null });
        return accounts.get(key);
      },
      async findUnique({ where }) {
        const key = keyOf(where.guildId_userId.guildId, where.guildId_userId.userId);
        const account = accounts.get(key);
        return account ? { ...account } : null;
      },
      async updateMany({ where, data }) {
        const key = keyOf(where.guildId, where.userId);
        const account = accounts.get(key);
        if (!account || (where.balance?.gte !== undefined && account.balance < where.balance.gte)) {
          return { count: 0 };
        }
        if (data.balance?.decrement !== undefined) account.balance -= data.balance.decrement;
        return { count: 1 };
      }
    },
    currencyPurchase: {
      async findUnique({ where }) {
        const key = where.guildId_userId_itemId;
        return purchases.get(purchaseKey(key.guildId, key.userId, key.itemId)) ?? null;
      },
      async findMany({ where }) {
        const prefix = keyOf(where.guildId, where.userId) + ":";
        return [...purchases.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([, value]) => value)
          .sort((a, b) => a.purchasedAt - b.purchasedAt);
      },
      async create({ data }) {
        const key = purchaseKey(data.guildId, data.userId, data.itemId);
        if (purchases.has(key)) throw new Error("Unique purchase constraint");
        purchases.set(key, { ...data });
        return data;
      }
    },
    currencyTransaction: {
      async create({ data }) {
        transactions.push({ ...data });
        return data;
      }
    }
  };
  return prisma;
}

test("shop catalog has unique item IDs and positive prices", () => {
  assert.equal(new Set(SHOP_ITEMS.map((item) => item.id)).size, SHOP_ITEMS.length);
  for (const item of SHOP_ITEMS) assert.ok(item.price > 0);
});

test("purchase deducts coins once and writes both inventory and ledger entries", async () => {
  const prisma = createFakePrisma(500);
  const now = new Date("2026-10-28T12:00:00.000Z");
  const item = SHOP_ITEMS[0];
  const result = await purchaseCurrencyItem(prisma, "lightx", "user-1", item.id, item.price, { now });

  assert.equal(result.purchased, true);
  assert.equal(result.account.balance, 500 - item.price);
  assert.deepEqual(await getCurrencyPurchases(prisma, "lightx", "user-1"), [{
    guildId: "lightx", userId: "user-1", itemId: item.id, purchasedAt: now
  }]);
  assert.equal(prisma.transactions.length, 1);
  assert.equal(prisma.transactions[0].amount, -item.price);
  assert.equal(prisma.transactions[0].type, "shop_purchase");
});

test("purchase refuses insufficient funds and repeated purchases without charging", async () => {
  const prisma = createFakePrisma(100);
  const item = SHOP_ITEMS[0];
  const poor = await purchaseCurrencyItem(prisma, "lightx", "user-2", item.id, item.price);
  assert.equal(poor.purchased, false);
  assert.equal(poor.reason, "insufficient_funds");
  assert.equal(poor.account.balance, 100);
  assert.equal(prisma.transactions.length, 0);

  const richPrisma = createFakePrisma(500);
  const first = await purchaseCurrencyItem(richPrisma, "lightx", "user-3", item.id, item.price);
  const second = await purchaseCurrencyItem(richPrisma, "lightx", "user-3", item.id, item.price);
  assert.equal(first.purchased, true);
  assert.equal(second.purchased, false);
  assert.equal(second.reason, "owned");
  assert.equal(second.account.balance, 500 - item.price);
  assert.equal(richPrisma.transactions.length, 1);
});

test("shop and buy commands require database context and reject direct messages", async () => {
  const replies = [];
  const interaction = {
    guildId: null,
    user: { id: "user-4" },
    options: { getString: () => SHOP_ITEMS[0].id },
    async reply(payload) { replies.push(payload); }
  };
  await shopCommand.execute(interaction, { prisma: createFakePrisma() });
  await buyCommand.execute(interaction, { prisma: createFakePrisma() });
  assert.equal(replies.length, 2);
  assert.ok(replies.every((reply) => reply.flags === MessageFlags.Ephemeral));
  await assert.rejects(shopCommand.execute(interaction), /requires a database/);
  await assert.rejects(buyCommand.execute(interaction), /requires a database/);
});


test("inventory displays owned collectibles and handles an empty collection", async () => {
  const prisma = createFakePrisma(500);
  const item = SHOP_ITEMS[0];
  await purchaseCurrencyItem(prisma, "lightx", "user-5", item.id, item.price);
  const replies = [];
  const interaction = {
    guildId: "lightx",
    user: { id: "user-5" },
    async reply(payload) { replies.push(payload); }
  };

  await inventoryCommand.execute(interaction, { prisma });
  assert.match(panelText(replies[0]), /Neon Badge/);

  const emptyInteraction = {
    ...interaction,
    user: { id: "user-without-items" },
    async reply(payload) { replies.push(payload); }
  };
  await inventoryCommand.execute(emptyInteraction, { prisma });
  assert.match(panelText(replies[1]), /waiting for its first unlock/);
});


test("purchases are isolated per server and invalid purchase inputs are rejected", async () => {
  const prisma = createFakePrisma(500);
  const item = SHOP_ITEMS[0];
  const first = await purchaseCurrencyItem(prisma, "lightx", "same-user", item.id, item.price);
  const otherServer = await purchaseCurrencyItem(prisma, "test-server", "same-user", item.id, item.price);

  assert.equal(first.purchased, true);
  assert.equal(otherServer.purchased, true);
  assert.equal((await getCurrencyPurchases(prisma, "lightx", "same-user")).length, 1);
  assert.equal((await getCurrencyPurchases(prisma, "test-server", "same-user")).length, 1);

  const before = prisma.transactions.length;
  await assert.rejects(purchaseCurrencyItem(prisma, "lightx", "bad-price", item.id, 0), /positive integer/);
  await assert.rejects(purchaseCurrencyItem(prisma, "lightx", "bad-item", "Bad Item", item.price), /item ID/);
  await assert.rejects(
    purchaseCurrencyItem(prisma, "lightx", "bad-date", item.id, item.price, { now: new Date("invalid") }),
    /valid Date/
  );
  assert.equal(prisma.transactions.length, before);
});
