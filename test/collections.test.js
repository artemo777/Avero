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

  const panel = response.components[0].toJSON();
  const text = panel.components.flatMap((component) =>
    component.type === 10 ? [component.content] :
    component.type === 9 ? component.components.map((part) => part.content) : []
  ).join("\n");
  assert.match(text, /The Collection Atlas/);
  assert.match(text, /1 \/ 3 themed sets completed/);
  assert.match(text, /The Archive Protocol/);
  assert.match(text, /Archive Keeper · Unlocked/);
  assert.match(text, /Neon Circuit/);
  assert.equal(response.embeds, undefined);
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
