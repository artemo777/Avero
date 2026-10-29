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
