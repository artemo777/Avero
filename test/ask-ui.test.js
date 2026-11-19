import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { handleMoneyRequestButton } from "../src/bot/ask-ui.js";

test("money request responses are blocked while server currency is paused", async () => {
  let response;
  const interaction = {
    customId: "avero-ask|request-1|accept",
    reply: async (payload) => { response = payload; }
  };
  const prisma = new Proxy({}, {
    get() {
      throw new Error("A paused transfer must not access the database.");
    }
  });

  const handled = await handleMoneyRequestButton(interaction, prisma, { currencyEnabled: false });

  assert.equal(handled, true);
  assert.deepEqual(response, {
    content: "Currency is paused by this server's admins. This transfer cannot be completed right now.",
    flags: MessageFlags.Ephemeral
  });
});

test("money request declines remain available while server currency is paused", async () => {
  let update;
  const interaction = {
    customId: "avero-ask|request-2|decline",
    guildId: "guild-1",
    user: { id: "user-2" },
    update: async (payload) => { update = payload; }
  };
  const request = {
    id: "request-2",
    guildId: "guild-1",
    requesterId: "user-1",
    targetId: "user-2",
    amount: 50,
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000)
  };
  const prisma = {
    $transaction: async (callback) => callback({
      moneyRequest: {
        findUnique: async () => request,
        updateMany: async () => ({ count: 1 })
      }
    })
  };

  const handled = await handleMoneyRequestButton(interaction, prisma, { currencyEnabled: false });

  assert.equal(handled, true);
  assert.ok(update.components?.length);
});
