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
