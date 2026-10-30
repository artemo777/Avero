import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { vaultCommand } from "../src/bot/commands/vault.js";
import { createVaultChallenge } from "../src/bot/vault-puzzle.js";

function makePrisma() {
  const account = { balance: 0, lastGameRewardAt: null };
  const transactions = [];
  const claims = [];
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyTransaction: { create: async ({ data }) => { transactions.push(data); return data; } },
    dailyContractClaim: {
      findUnique: async ({ where }) => claims.find((claim) => claim.guildId === where.guildId_userId_contractDate_contractId.guildId && claim.userId === where.guildId_userId_contractDate_contractId.userId && claim.contractDate === where.guildId_userId_contractDate_contractId.contractDate && claim.contractId === where.guildId_userId_contractDate_contractId.contractId) ?? null,
      create: async ({ data }) => { claims.push(data); return data; }
    },
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
  return { prisma, transactions, account, claims };
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

test("vault command shows daily clues before a code is submitted", async () => {
  const now = new Date("2026-10-30T12:00:00.000Z");
  const { interaction, response } = interactionFor(null);

  await vaultCommand.execute(interaction, { now });

  assert.equal(response().flags, MessageFlags.IsComponentsV2);
  const text = response().components[0].toJSON().components[0].content;
  assert.match(text, /Today's vault is ready/);
  assert.match(text, /Dial 1:/);
  assert.match(text, /\/vault code:000/);
  assert.doesNotMatch(text, /Today's code/);
  assert.match(text, /One code submission per member per UTC day/);
  assert.equal(vaultCommand.data.options[0].required, false);
});

test("vault win records a free game result and shares the reward cooldown", async () => {
  const now = new Date("2026-10-30T12:00:00.000Z");
  const challenge = createVaultChallenge("guild-1", now);
  const { interaction, response } = interactionFor(challenge.code);
  const { prisma, transactions, account, claims } = makePrisma();

  await vaultCommand.execute(interaction, { prisma, now });

  assert.equal(response().flags, MessageFlags.IsComponentsV2);
  const text = response().components[0].toJSON().components.filter((part) => part.type === 10).map((part) => part.content).join("\n");
  assert.match(text, /Vault unlocked/);
  assert.match(text, /\+25 coins/);
  assert.match(text, /No entry fee or wager/);
  assert.equal(transactions[0].type, "vault_reward");
  assert.equal(transactions[1].type, "vault_win");
  assert.deepEqual(claims.map((claim) => claim.contractId).sort(), ["vault_attempt", "vault_reward"]);
  assert.equal(account.balance, 25);
});

test("a solved daily vault can award coins only once per UTC day", async () => {
  const now = new Date("2026-10-30T12:00:00.000Z");
  const challenge = createVaultChallenge("guild-1", now);
  const { prisma, transactions, account, claims } = makePrisma();

  const first = interactionFor(challenge.code);
  await vaultCommand.execute(first.interaction, { prisma, now });
  const second = interactionFor(challenge.code);
  await vaultCommand.execute(second.interaction, { prisma, now });

  assert.match(second.response().content, /already submitted today.s Vault code/);
  assert.equal(claims.filter((claim) => claim.contractId === "vault_attempt").length, 1);
  assert.equal(claims.filter((claim) => claim.contractId === "vault_reward").length, 1);
  assert.equal(transactions.filter((entry) => entry.type === "vault_reward").length, 1);
  assert.equal(transactions.filter((entry) => entry.type === "vault_win").length, 1);
  assert.equal(account.balance, 25);
});

test("vault wins respect the shared game reward cooldown", async () => {
  const now = new Date("2026-10-30T12:00:00.000Z");
  const challenge = createVaultChallenge("guild-1", now);
  const { interaction, response } = interactionFor(challenge.code);
  const { prisma, transactions, account } = makePrisma();
  account.balance = 75;
  account.lastGameRewardAt = new Date(now.getTime() - 5 * 60_000);

  await vaultCommand.execute(interaction, { prisma, now });

  const text = response().components[0].toJSON().components[0].content;
  assert.match(text, /Vault unlocked/);
  assert.match(text, /cooldown is active/);
  assert.equal(transactions.filter((entry) => entry.type === "vault_reward").length, 0);
  assert.equal(transactions.filter((entry) => entry.type === "vault_win").length, 1);
  assert.equal(account.balance, 75);
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
  assert.equal(claims.filter((claim) => claim.contractId === "vault_attempt").length, 1);
  assert.equal(account.balance, 0);
});

test("a wrong Vault submission cannot be retried to farm game rounds", async () => {
  const now = new Date("2026-10-30T12:00:00.000Z");
  const challenge = createVaultChallenge("guild-1", now);
  const wrong = challenge.code === "000" ? "001" : "000";
  const { prisma, transactions, claims } = makePrisma();

  const first = interactionFor(wrong);
  await vaultCommand.execute(first.interaction, { prisma, now });
  const retry = interactionFor(challenge.code);
  await vaultCommand.execute(retry.interaction, { prisma, now });

  assert.match(retry.response().content, /already submitted today.s Vault code/);
  assert.equal(transactions.filter((entry) => entry.type === "vault_loss").length, 1);
  assert.equal(transactions.filter((entry) => entry.type === "vault_win").length, 0);
  assert.equal(transactions.filter((entry) => entry.type === "vault_reward").length, 0);
  assert.equal(claims.filter((claim) => claim.contractId === "vault_attempt").length, 1);
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
