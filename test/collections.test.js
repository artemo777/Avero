import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { collectionsCommand } from "../src/bot/commands/collections.js";

test("collections command renders route-linked set progress for a server member", async () => {
  let response;
  const prisma = {
    currencyPurchase: {
      findMany: async ({ where }) => {
        assert.deepEqual(where, { guildId: "guild-1", userId: "user-1" });
        return [{ itemId: "neon_badge" }, { itemId: "vault_badge" }, { itemId: "avero_relic" }];
      }
    }
  };
  await collectionsCommand.execute({
    guildId: "guild-1",
    user: { id: "user-1", username: "Ada" },
    options: { getUser: () => null },
    reply: async (payload) => { response = payload; }
  }, { prisma });

  const embed = response.embeds[0];
  assert.match(embed.title, /Ada's Avero collections/);
  assert.match(embed.description, /1 \/ 3 sets completed/);
  assert.equal(embed.fields.length, 3);
  assert.match(embed.fields[0].name, /The Archive Protocol · 3\/3/);
  assert.match(embed.fields[0].value, /Archive Keeper · Unlocked/);
  assert.deepEqual(response.allowedMentions, { parse: [] });
});

test("collections command rejects direct messages privately", async () => {
  let response;
  await collectionsCommand.execute({
    guildId: null,
    reply: async (payload) => { response = payload; }
  }, { prisma: {} });
  assert.deepEqual(response, {
    content: "Avero collection sets are available inside a server.",
    flags: MessageFlags.Ephemeral
  });
});
