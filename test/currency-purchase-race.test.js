import test from "node:test";
import assert from "node:assert/strict";
import { purchaseCurrencyItem } from "../src/db/currency-repository.js";

function uniqueConstraintError() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

test("concurrent duplicate purchase resolves as already owned", async () => {
  const account = { guildId: "guild-1", userId: "user-1", balance: 75 };
  const purchase = { guildId: "guild-1", userId: "user-1", itemId: "neon_badge" };
  const prisma = {
    // The transaction's unique constraint can fail after the first ownership
    // check; Prisma rolls back the losing transaction before rejecting.
    async $transaction() {
      throw uniqueConstraintError();
    },
    currencyPurchase: {
      async findUnique() { return purchase; }
    },
    currencyAccount: {
      async findUnique() { return account; }
    }
  };

  const result = await purchaseCurrencyItem(
    prisma,
    "guild-1",
    "user-1",
    "neon_badge",
    50
  );

  assert.equal(result.purchased, false);
  assert.equal(result.reason, "owned");
  assert.equal(result.account, account);
});

test("unrelated transaction errors are not hidden as duplicate purchases", async () => {
  const failure = Object.assign(new Error("database unavailable"), { code: "P1001" });
  const prisma = {
    async $transaction() { throw failure; }
  };

  await assert.rejects(
    purchaseCurrencyItem(prisma, "guild-1", "user-1", "neon_badge", 50),
    (error) => error === failure
  );
});

test("a unique constraint error without an existing purchase is rethrown", async () => {
  const failure = uniqueConstraintError();
  const prisma = {
    async $transaction() { throw failure; },
    currencyPurchase: {
      async findUnique() { return null; }
    },
    currencyAccount: {
      async findUnique() { return { balance: 75 }; }
    }
  };

  await assert.rejects(
    purchaseCurrencyItem(prisma, "guild-1", "user-1", "neon_badge", 50),
    (error) => error === failure
  );
});

function createPurchasePrisma(initialBalance) {
  const account = {
    guildId: "guild-2",
    userId: "user-2",
    balance: initialBalance
  };
  const purchases = new Map();
  const transactions = [];
  const keyOf = ({ guildId, userId, itemId }) => guildId + ":" + userId + ":" + itemId;
  const prisma = {
    account,
    purchases,
    transactions,
    $transaction: (callback) => callback(prisma),
    currencyAccount: {
      async upsert() { return account; },
      async findUnique() { return { ...account }; },
      async updateMany({ where, data }) {
        if (where.balance?.gte !== undefined && account.balance < where.balance.gte) {
          return { count: 0 };
        }
        if (data.balance?.decrement !== undefined) account.balance -= data.balance.decrement;
        return { count: 1 };
      }
    },
    currencyPurchase: {
      async findUnique({ where }) { return purchases.get(keyOf(where.guildId_userId_itemId)) ?? null; },
      async create({ data }) {
        const key = keyOf(data);
        if (purchases.has(key)) throw uniqueConstraintError();
        purchases.set(key, data);
        return data;
      }
    },
    currencyTransaction: {
      async create({ data }) { transactions.push(data); return data; }
    }
  };
  return prisma;
}

test("parallel purchases of different items cannot overspend the same balance", async () => {
  const prisma = createPurchasePrisma(100);
  const results = await Promise.all([
    purchaseCurrencyItem(prisma, "guild-2", "user-2", "neon_badge", 80),
    purchaseCurrencyItem(prisma, "guild-2", "user-2", "vault_badge", 80)
  ]);

  assert.equal(results.filter((result) => result.purchased).length, 1);
  assert.equal(prisma.account.balance, 20);
  assert.ok(prisma.account.balance >= 0);
  assert.equal(prisma.transactions.length, 1);
  assert.equal(prisma.transactions[0].amount, -80);
});


test("purchase rechecks ownership when a concurrent debit makes the balance update lose", async () => {
  const account = { guildId: "guild-3", userId: "user-3", balance: 0 };\n  let accountReads = 0;
  const purchase = { guildId: "guild-3", userId: "user-3", itemId: "neon_badge" };
  let ownershipChecks = 0;
  const prisma = {
    $transaction: async (callback) => callback({
      currencyAccount: {
        async upsert() {},
        async findUnique() { accountReads += 1; return { ...account, balance: accountReads === 1 ? 100 : 0 }; },
        async updateMany() { return { count: 0 }; }
      },
      currencyPurchase: {
        async findUnique() {
          ownershipChecks += 1;
          return ownershipChecks === 1 ? null : purchase;
        }
      }
    })
  };

  const result = await purchaseCurrencyItem(prisma, "guild-3", "user-3", "neon_badge", 50);
  assert.equal(ownershipChecks, 2);
  assert.equal(result.purchased, false);
  assert.equal(result.reason, "owned");
  assert.equal(result.account.balance, 0);
});
