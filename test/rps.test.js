import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { rpsCommand } from "../src/bot/commands/rps.js";

function panelText(response) {
  return response.components[0].toJSON().components.filter((component) => component.type === 10).map((component) => component.content).join("\n");
}

function makeInteraction({ guildId = "guild-1", choice = "rock" } = {}) {
  let response;
  return {
    interaction: {
      guildId,
      user: { id: "user-1" },
      options: { getString: (name) => {
        assert.equal(name, "choice");
        return choice;
      } },
      reply: async (payload) => { response = payload; }
    },
    getResponse: () => response
  };
}

test("rock paper scissors records game results and rewards wins without wagers", async () => {
  const { interaction, getResponse } = makeInteraction();
  const records = [];
  const account = { balance: 0, lastGameRewardAt: null };
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyTransaction: { create: async ({ data }) => { records.push(data); return data; } },
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
  await rpsCommand.execute(interaction, { prisma });
  const response = getResponse();

  assert.equal(response.flags, MessageFlags.IsComponentsV2);
  const text = panelText(response);
  assert.match(text, /You: Rock/);
  assert.match(text, /Avero: (Rock|Paper|Scissors)/);
  assert.match(text, /no wagers/i);
  assert.ok(response.components[0].toJSON().components.some((component) => component.type === 1));
  assert.ok(records.length === 1 || records.length === 2);
  assert.equal(records[0].guildId, "guild-1");
  assert.equal(records[0].userId, "user-1");
  assert.equal(records[0].amount, 0);
  assert.match(records[0].type, /^rps_(win|loss|tie)$/);
  assert.equal(records.filter((record) => record.type === "rps_reward").length, records[0].type === "rps_win" ? 1 : 0);
});

test("rock paper scissors rejects direct messages", async () => {
  const { interaction, getResponse } = makeInteraction({ guildId: null });
  await rpsCommand.execute(interaction);
  assert.deepEqual(getResponse(), {
    content: "Games can only be played inside a server.",
    flags: MessageFlags.Ephemeral
  });
});

test("rock paper scissors validates the choice", async () => {
  const { interaction, getResponse } = makeInteraction({ choice: "banana" });
  await rpsCommand.execute(interaction);
  assert.deepEqual(getResponse(), {
    content: "Choose rock, paper, or scissors.",
    flags: MessageFlags.Ephemeral
  });
});
