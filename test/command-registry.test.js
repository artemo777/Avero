import test from "node:test";
import assert from "node:assert/strict";
import { commands } from "../src/bot/commands/index.js";
import { createCommandMap, getCommandDefinitions } from "../src/bot/command-registry.js";

test("all Avero slash commands have unique valid names and executable handlers", () => {
  const map = createCommandMap(commands);
  const definitions = getCommandDefinitions(commands);

  assert.ok(definitions.length > 0);
  assert.equal(map.size, definitions.length);
  assert.equal(new Set(definitions.map((command) => command.name)).size, definitions.length);

  for (const definition of definitions) {
    assert.match(definition.name, /^[a-z0-9_-]{1,32}$/);
    assert.ok(definition.description.length > 0);
  }
});

test("command registry rejects duplicate command names", () => {
  const command = {
    data: { name: "balance", description: "Show balance" },
    execute: async () => {}
  };
  assert.throws(() => createCommandMap([command, command]), /Duplicate command name: balance/);
});

test("command registry rejects commands without executable handlers", () => {
  assert.throws(
    () => createCommandMap([{ data: { name: "balance", description: "Show balance" } }]),
    /must have an execute function/
  );
});
