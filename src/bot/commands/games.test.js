import test from "node:test";
import assert from "node:assert/strict";
import { gamesCommand } from "./games.js";

test("games command is registered with a concise description", () => {
  assert.equal(gamesCommand.data.name, "games");
  assert.ok(gamesCommand.data.description.length <= 100);
});

test("games command opens the quick-play panel in a server", async () => {
  let reply;
  await gamesCommand.execute({
    guildId: "123456789012345678",
    user: { id: "234567890123456789" },
    reply: async (payload) => { reply = payload; }
  });
  assert.ok(reply);
  assert.equal(reply.components.length, 1);
  assert.ok(reply.flags);
  const panel = reply.components[0].toJSON();
  const actionRows = panel.components.filter((component) => component.type === 1);
  const buttons = actionRows.flatMap((row) => row.components);
  assert.equal(buttons.length, 8);
  assert.ok(buttons.some((button) => button.custom_id.includes("|guess|1")));
  assert.ok(buttons.some((button) => button.custom_id.includes("|rps|rock")));
});

test("games command rejects direct messages privately", async () => {
  let reply;
  await gamesCommand.execute({
    guildId: null,
    user: { id: "234567890123456789" },
    reply: async (payload) => { reply = payload; }
  });
  assert.match(reply.content, /inside a server/);
  assert.ok(reply.flags);
});
