import test from "node:test";
import assert from "node:assert/strict";
import { claimScavengeReward } from "../src/db/currency-repository.js";
import { runScavenge, SCAVENGE_ROUTES } from "../src/bot/game-ui.js";
import { scavengeCommand } from "../src/bot/commands/scavenge.js";
import { SHOP_ITEMS } from "../src/bot/shop-catalog.js";

function panelText(response) {
  return response.components[0].toJSON().components
    .filter((component) => component.type === 10)
    .map((component) => component.content)
    .join("\n");
}

function fakePrisma() {
  const accounts = new Map();
  const purchases = new Map();
  const transactions = [];
  const accountKey = (guildId, userId) => guildId + ":" + userId;
  const purchaseKey = (guildId, userId, itemId) => accountKey(guildId, userId) + ":" + itemId;
  const prisma = {
    accounts, purchases, transactions,
    $transaction: (callback) => callback(prisma),
    currencyAccount: {
      async upsert({ where, create }) {
        const key = accountKey(where.guildId_userId.guildId, where.guildId_userId.userId);
        if (!accounts.has(key)) accounts.set(key, { ...create, balance: 0, lastDailyAt: null, lastWorkAt: null, lastScavengeAt: null });
        return accounts.get(key);
      },
      async updateMany({ where, data }) {
        const key = accountKey(where.guildId, where.userId);
        const account = accounts.get(key);
        if (!account) return { count: 0 };
        if (where.OR) {
          const allowed = where.OR.some((condition) => {
            if (Object.hasOwn(condition, "lastScavengeAt") && condition.lastScavengeAt === null) return account.lastScavengeAt === null;
            return Boolean(condition.lastScavengeAt?.lte && account.lastScavengeAt && account.lastScavengeAt <= condition.lastScavengeAt.lte);
          });
          if (!allowed) return { count: 0 };
        }
        if (data.balance?.increment) account.balance += data.balance.increment;
        if (data.lastScavengeAt) account.lastScavengeAt = data.lastScavengeAt;
        return { count: 1 };
      },
      async findUnique({ where }) {
        const key = accountKey(where.guildId_userId.guildId, where.guildId_userId.userId);
        const account = accounts.get(key);
        return account ? { ...account } : null;
      }
    },
    currencyPurchase: {
      async findUnique({ where }) {
        const key = where.guildId_userId_itemId;
        return purchases.get(purchaseKey(key.guildId, key.userId, key.itemId)) ?? null;
      },
      async create({ data }) {
        const key = purchaseKey(data.guildId, data.userId, data.itemId);
        if (purchases.has(key)) throw new Error("Unique purchase constraint");
        purchases.set(key, { ...data });
        return data;
      }
    },
    currencyTransaction: {
      async create({ data }) { transactions.push({ ...data }); return data; }
    }
  };
  return prisma;
}

test("scavenge pays coins, saves collectible drops, and records the transaction", async () => {
  const prisma = fakePrisma();
  const now = new Date("2026-10-28T12:00:00.000Z");
  const result = await claimScavengeReward(prisma, "guild-1", "user-1", {
    amount: 40, itemId: "neon_badge", now
  });

  assert.equal(result.claimed, true);
  assert.equal(result.amount, 40);
  assert.equal(result.itemId, "neon_badge");
  assert.equal(result.account.balance, 40);
  assert.equal(result.account.lastScavengeAt.getTime(), now.getTime());
  assert.equal(prisma.purchases.size, 1);
  assert.equal(prisma.transactions[0].type, "scavenge");
  assert.equal(prisma.transactions[0].amount, 40);
  assert.deepEqual(prisma.transactions[1], {
    guildId: "guild-1",
    userId: "user-1",
    amount: 0,
    type: "scavenge_collectible",
    createdAt: now
  });
});

test("scavenge cooldown blocks duplicate payouts", async () => {
  const prisma = fakePrisma();
  const now = new Date("2026-10-28T12:00:00.000Z");
  await claimScavengeReward(prisma, "guild-1", "user-1", { amount: 35, now });
  const result = await claimScavengeReward(prisma, "guild-1", "user-1", {
    amount: 50, now: new Date(now.getTime() + 60_000)
  });

  assert.equal(result.claimed, false);
  assert.equal(result.account.balance, 35);
  assert.equal(prisma.transactions.length, 1);
});

test("duplicate scavenge drops award a coin bonus without duplicating collection", async () => {
  const prisma = fakePrisma();
  const now = new Date("2026-10-28T12:00:00.000Z");
  await claimScavengeReward(prisma, "guild-1", "user-1", {
    amount: 35, itemId: "neon_badge", now
  });
  const result = await claimScavengeReward(prisma, "guild-1", "user-1", {
    amount: 40, itemId: "neon_badge", now: new Date(now.getTime() + 600_000)
  });

  assert.equal(result.claimed, true);
  assert.equal(result.itemId, null);
  assert.equal(result.duplicateItemId, "neon_badge");
  assert.equal(result.bonus, 35);
  assert.equal(result.amount, 75);
  assert.equal(result.account.balance, 110);
  assert.equal(prisma.purchases.size, 1);
  assert.equal(prisma.transactions.length, 3);
  assert.equal(prisma.transactions.filter((entry) => entry.type === "scavenge_collectible").length, 1);
});

test("scavenge validates reward, cooldown, item ID, and timestamp", async () => {
  const prisma = fakePrisma();
  await assert.rejects(claimScavengeReward(prisma, "g", "u", { amount: 0 }), /positive integer/);
  await assert.rejects(claimScavengeReward(prisma, "g", "u", { cooldownMs: 0 }), /positive safe integer/);
  await assert.rejects(claimScavengeReward(prisma, "g", "u", { itemId: "Not an item" }), /item ID/);
  await assert.rejects(claimScavengeReward(prisma, "g", "u", { now: new Date("invalid") }), /valid Date/);
});



test("expedition routes are unique and only reference shop collectibles", () => {
  assert.deepEqual(SCAVENGE_ROUTES.map((route) => route.id), ["archive", "plaza", "garden"]);
  assert.equal(new Set(SCAVENGE_ROUTES.map((route) => route.id)).size, SCAVENGE_ROUTES.length);
  const itemIds = new Set(SHOP_ITEMS.map((item) => item.id));
  for (const route of SCAVENGE_ROUTES) {
    assert.ok(route.name);
    assert.ok(route.description);
    assert.ok(route.items.length > 0);
    assert.ok(route.items.every((item) => itemIds.has(item.id) && Number.isSafeInteger(item.weight) && item.weight > 0));
  }
});

test("scavenge expedition keeps the selected route and offers a same-route replay", async () => {
  const response = await runScavenge(fakePrisma(), "guild-1", "user-1", "garden");
  const text = panelText(response);
  assert.match(text, /Moonlit Garden/);
  assert.match(text, /lantern path/);
  const buttons = response.components[0].toJSON().components
    .filter((component) => component.type === 1)
    .flatMap((row) => row.components);
  assert.ok(buttons.some((entry) => entry.custom_id === "avero|user-1|scavenge|garden"));
});

test("scavenge rejects unknown expedition routes before database work", async () => {
  await assert.rejects(runScavenge({}, "guild-1", "user-1", "not-a-route"), /valid scavenge route/);
});

test("scavenge slash command exposes route choices and rejects invalid values", async () => {
  const option = scavengeCommand.data.options[0];
  assert.equal(option.name, "route");
  assert.deepEqual(option.choices.map((choice) => choice.value), ["archive", "plaza", "garden"]);
  let response;
  await scavengeCommand.execute({
    guildId: "guild-1",
    user: { id: "user-1" },
    options: { getString: () => "invalid" },
    reply: async (payload) => { response = payload; }
  }, { prisma: {} });
  assert.equal(response.content, "Choose one of the listed expedition routes.");
});
