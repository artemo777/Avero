import test from "node:test";
import assert from "node:assert/strict";
import { createMoneyRequest, respondToMoneyRequest } from "../src/db/money-request-repository.js";

function fakePrisma() {
  const requests = new Map();
  const accounts = new Map();
  const ledger = [];
  let nextId = 1;
  const accountKey = ({ guildId, userId }) => guildId + ":" + userId;
  const prisma = {
    requests, accounts, ledger,
    moneyRequest: {
      async create({ data }) {
        const row = { id: "request-" + nextId++, status: "pending", ...data };
        requests.set(row.id, row);
        return { ...row };
      },
      async findUnique({ where }) {
        const row = requests.get(where.id);
        return row ? { ...row } : null;
      },
      async update({ where, data }) {
        const row = requests.get(where.id);
        Object.assign(row, data);
        return { ...row };
      },
      async updateMany({ where, data }) {
        const row = requests.get(where.id);
        if (!row || row.status !== where.status ||
          (where.expiresAt?.gt && row.expiresAt <= where.expiresAt.gt) ||
          (where.expiresAt?.lte && row.expiresAt > where.expiresAt.lte)) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }
    },
    currencyAccount: {
      async upsert({ where, create }) {
        const key = accountKey(where.guildId_userId);
        if (!accounts.has(key)) accounts.set(key, { ...create, balance: 0, gemBalance: 0 });
        return accounts.get(key);
      },
      async updateMany({ where, data }) {
        const account = accounts.get(accountKey(where));
        if (!account || (where.balance?.gte !== undefined && account.balance < where.balance.gte)) return { count: 0 };
        if (data.balance?.increment !== undefined) account.balance += data.balance.increment;
        if (data.balance?.decrement !== undefined) account.balance -= data.balance.decrement;
        return { count: 1 };
      },
      async findUnique({ where }) {
        const account = accounts.get(accountKey(where.guildId_userId));
        return account ? { ...account } : null;
      }
    },
    currencyTransaction: {
      async createMany({ data }) { ledger.push(...data); return { count: data.length }; }
    },
    async $transaction(callback) { return callback(prisma); }
  };
  return prisma;
}

test("coin requests transfer only virtual coins after recipient acceptance", async () => {
  const prisma = fakePrisma();
  await prisma.currencyAccount.upsert({ where: { guildId_userId: { guildId: "__avero_global__", userId: "payer" } }, create: { guildId: "__avero_global__", userId: "payer" } });
  await prisma.currencyAccount.updateMany({ where: { guildId: "__avero_global__", userId: "payer" }, data: { balance: { increment: 500 } } });
  const request = await createMoneyRequest(prisma, "g", "requester", "payer", 125, { now: new Date("2026-11-01T12:00:00Z") });
  const result = await respondToMoneyRequest(prisma, "g", request.id, "payer", "accept", { now: new Date("2026-11-01T12:01:00Z") });
  assert.equal(result.accepted, true);
  assert.equal(result.payer.balance, 375);
  assert.equal(result.receiver.balance, 125);
  assert.equal(prisma.ledger.length, 2);
  assert.equal(prisma.ledger.reduce((sum, entry) => sum + entry.amount, 0), 0);
  const duplicate = await respondToMoneyRequest(prisma, "g", request.id, "payer", "accept");
  assert.equal(duplicate.reason, "handled");
});

test("coin requests can only be answered by the tagged recipient", async () => {
  const prisma = fakePrisma();
  const request = await createMoneyRequest(prisma, "g", "requester", "target", 50);
  const result = await respondToMoneyRequest(prisma, "g", request.id, "other", "accept");
  assert.equal(result.reason, "not_target");
});

test("declining or lacking funds never moves coins", async () => {
  const prisma = fakePrisma();
  const request = await createMoneyRequest(prisma, "g", "requester", "target", 50);
  const insufficient = await respondToMoneyRequest(prisma, "g", request.id, "target", "accept");
  assert.equal(insufficient.reason, "insufficient_funds");
  assert.equal(prisma.ledger.length, 0);
  const declined = await respondToMoneyRequest(prisma, "g", request.id, "target", "decline");
  assert.equal(declined.accepted, false);
  assert.equal(prisma.ledger.length, 0);
});

test("coin requests validate recipient, self-requests, and amount limits", async () => {
  const prisma = fakePrisma();
  await assert.rejects(createMoneyRequest(prisma, "g", "same", "same", 10), /yourself/);
  await assert.rejects(createMoneyRequest(prisma, "g", "a", "b", 0), /between 1/);
  await assert.rejects(createMoneyRequest(prisma, "g", "a", "b", 10001), /between 1/);
});

test("decline reports already handled when its conditional update loses a race", async () => {
  const prisma = fakePrisma();
  const request = await createMoneyRequest(prisma, "g", "requester", "target", 50);
  prisma.moneyRequest.updateMany = async () => ({ count: 0 });
  const result = await respondToMoneyRequest(prisma, "g", request.id, "target", "decline");
  assert.equal(result.completed, false);
  assert.equal(result.reason, "handled");
});

test("expiry never overwrites a request that another response already handled", async () => {
  const prisma = fakePrisma();
  const createdAt = new Date("2026-11-01T12:00:00Z");
  const request = await createMoneyRequest(prisma, "g", "requester", "target", 50, { now: createdAt });
  prisma.moneyRequest.updateMany = async () => ({ count: 0 });
  const result = await respondToMoneyRequest(prisma, "g", request.id, "target", "accept", {
    now: new Date(createdAt.getTime() + 11 * 60 * 1000)
  });
  assert.equal(result.completed, false);
  assert.equal(result.reason, "handled");
});
