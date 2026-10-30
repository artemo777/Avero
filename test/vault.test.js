import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { vaultCommand } from "../src/bot/commands/vault.js";
import { createVaultChallenge } from "../src/bot/vault-puzzle.js";

function makePrisma() {
  const account = { balance: 0, lastGameRewardAt: null };
  const transactions = [];
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyTransaction: { create: async ({ data }) => { transactions.push(data); return data; } },
    currencyAccount: {
      upsert: async () => account,
      updateMany: async ({ where, data }) => {
        if (where.OR && account.lastGameRewardAt !== null) return { count: 0 };
        account.balance += data.balance.increment;
        account.lastGameRewardAt = data.lastGameRewardAt;
        return { count: 1 };
      },
      findUnique: async () => ({ ...account })
    }
  };
  return { prisma, transactions, account };
}

function interactionFor(code, guildId = "guild-1") {
  let response;
  return {
    interaction: {
      guildId,
      user: { id: "user-1" },
      options: { getString: () => code },
      reply: async (payload) => { response = payload; }
    },
    response: () => response
  };
}

test("daily vault challenge is deterministic per server and UTC date", () => {
  const now = new Date("2026-10-30T12:00:00.000Z");
  const first = createVaultChallenge("guild-1", now);
  assert.deepEqual(createVaultChallenge("guild-1", now), first);
  assert.notEqual(createVaultChallenge("guild-2", now).code, first.code);
  assert.notEqual(createVaultChallenge("guild-1", new Date("2026-10-31T00:00:00.000Z")).code, first.code);
  assert.match(first.code, /^\d{3}$/);
  assert.equal(first.clues.length, 3);
});

test("vault win records a free game result and shares the reward cooldown", async () => {
  const now = new Date("2026-10-30T12:00:00.000Z");
  const challenge = createVaultChallenge("guild-1", now);
  const { interaction, response } = interactionFor(challenge.code);
  const { prisma, transactions, account } = makePrisma();

  await vaultCommand.execute(interaction, { prisma, now });

  assert.equal(response().flags, MessageFlags.IsComponentsV2);
  const text = response().components[0].toJSON().components.filter((part) => part.type === 10).map((part) => part.content).join("\n");
  assert.match(text, /Vault unlocked/);
  assert.match(text, /\+25 coins/);
  assert.match(text, /No entry fee or wager/);
  assert.equal(transactions[0].type, "vault_win");
  assert.equal(transactions[1].type, "vault_reward");
  assert.equal(account.balance, 25);
});

test("vault loss records a result but never changes the balance", async () => {
  const now = new Date("2026-10-30T12:00:00.000Z");
  const challenge = createVaultChallenge("guild-1", now);
  const wrong = challenge.code === "000" ? "001" : "000";
  const { interaction, response } = interactionFor(wrong);
  const { prisma, transactions, account } = makePrisma();

  await vaultCommand.execute(interaction, { prisma, now });

  assert.match(response().components[0].toJSON().components[0].content, /Vault stays locked/);
  assert.doesNotMatch(response().components[0].toJSON().components[0].content, /Today/);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].type, "vault_loss");
  assert.equal(account.balance, 0);
});

test("vault rejects invalid codes and direct messages without database writes", async () => {
  let invalid;
  const bad = interactionFor("12x");
  await vaultCommand.execute(bad.interaction, { prisma: {} });
  invalid = bad.response();
  assert.deepEqual(invalid, {
    content: "Enter exactly three digits (000–999).",
    flags: MessageFlags.Ephemeral
  });

  const dm = interactionFor("123", null);
  await vaultCommand.execute(dm.interaction);
  assert.deepEqual(dm.response(), {
    content: "The Vault is available inside a server.",
    flags: MessageFlags.Ephemeral
  });
});
