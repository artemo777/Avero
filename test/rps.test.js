import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { rpsCommand } from "../src/bot/commands/rps.js";

function makeInteraction({ guildId = "guild-1", choice = "rock" } = {}) {
  let response;
  return {
    interaction: {
      guildId,
      options: { getString: (name) => {
        assert.equal(name, "choice");
        return choice;
      } },
      reply: async (payload) => { response = payload; }
    },
    getResponse: () => response
  };
}

test("rock paper scissors returns a public game result without touching currency", async () => {
  const { interaction, getResponse } = makeInteraction();
  await rpsCommand.execute(interaction);
  const response = getResponse();

  assert.equal(response.flags, undefined);
  assert.equal(response.embeds.length, 1);
  assert.match(response.embeds[0].description, /\*\*YOU\*\*\\nRock/);
  assert.match(response.embeds[0].description, /\*\*AVERO\*\*\\n(Rock|Paper|Scissors)/);
  assert.match(response.embeds[0].footer.text, /no coins involved/i);
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
