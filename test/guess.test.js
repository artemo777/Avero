import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { guessCommand } from "../src/bot/commands/guess.js";

function panelText(response) {
  return response.components[0].toJSON().components.filter((component) => component.type === 10).map((component) => component.content).join("\n");
}

function makePrisma() {
  const accounts = new Map();
  const transactions = [];
  const keyOf = (value) => value.guildId + ":" + value.userId;
  const prisma = {
    accounts,
    transactions,
    $transaction: (callback) => callback(prisma),
    currencyAccount: {
      async upsert({ where, create }) {
        const key = keyOf(where.guildId_userId);
        if (!accounts.has(key)) accounts.set(key, { ...create, balance: 0, lastDailyAt: null });
        return accounts.get(key);
      },
      async updateMany({ where, data }) {
        const account = accounts.get(keyOf(where));
        if (!account) return { count: 0 };
        account.balance += data.balance.increment;
        return { count: 1 };
      },
      async findUnique({ where }) {
        const account = accounts.get(keyOf(where.guildId_userId));
        return account ? { ...account } : null;
      }
    },
    currencyTransaction: {
      async create({ data }) { transactions.push(data); return data; }
    }
  };
  return prisma;
}

function makeInteraction({ guildId = "guild-1", guess = 3 } = {}) {
  let response;
  return {
    interaction: {
      guildId,
      user: { id: "user-1" },
      options: { getInteger: (name) => {
        assert.equal(name, "number");
        return guess;
      } },
      reply: async (payload) => { response = payload; }
    },
    getResponse: () => response
  };
}

test("guess command responds and never requires a wager", async () => {
  const prisma = makePrisma();
  const { interaction, getResponse } = makeInteraction();

  await guessCommand.execute(interaction, { prisma });

  const response = getResponse();
  assert.ok(response.components?.length === 1);
  assert.equal(response.flags, MessageFlags.IsComponentsV2);
  const account = prisma.accounts.get("guild-1:user-1");
  assert.equal(account?.balance ?? 0, panelText(response).includes("+25 coins") ? 25 : 0);
  assert.equal(prisma.transactions.length, account?.balance ? 1 : 0);
});

test("guess command rejects direct messages", async () => {
  const prisma = makePrisma();
  const { interaction, getResponse } = makeInteraction({ guildId: null });

  await guessCommand.execute(interaction, { prisma });

  assert.deepEqual(getResponse(), {
    content: "Guess can only be played inside a server.",
    flags: MessageFlags.Ephemeral
  });
});
