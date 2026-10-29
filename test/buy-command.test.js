import test from "node:test";
import assert from "node:assert/strict";
import { buyCommand } from "../src/bot/commands/buy.js";

test("slash-command purchase renders guild custom emojis when available", async () => {
  const envKeys = ["DISCORD_GUILD_ID", "AVERO_EMOJI_COIN_ID", "AVERO_EMOJI_NEON_BADGE_ID"];
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  process.env.DISCORD_GUILD_ID = "12345678901234567";
  process.env.AVERO_EMOJI_COIN_ID = "23456789012345678";
  process.env.AVERO_EMOJI_NEON_BADGE_ID = "34567890123456789";

  const account = { guildId: "12345678901234567", userId: "user-1", balance: 500 };
  let response;
  const prisma = {
    async $transaction(callback) { return callback(this); },
    currencyAccount: {
      async upsert() {},
      async findUnique() { return account; },
      async updateMany({ data }) {
        account.balance -= data.balance.decrement;
        return { count: 1 };
      }
    },
    currencyPurchase: {
      async findUnique() { return null; },
      async create() { return {}; }
    },
    currencyTransaction: {
      async create() { return {}; }
    }
  };
  const interaction = {
    guildId: "12345678901234567",
    user: { id: "user-1" },
    options: { getString: () => "neon_badge" },
    reply: async (payload) => { response = payload; }
  };

  try {
    await buyCommand.execute(interaction, { prisma });
    const rendered = JSON.stringify(response);
    assert.match(rendered, /<:avero_neon_badge:34567890123456789>/);
    assert.match(rendered, /23456789012345678/);
  } finally {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
