import test from "node:test";
import assert from "node:assert/strict";
import { createCommandMap, getCommandDefinitions } from "../src/bot/command-registry.js";
import { loadBotConfig, requireApplicationId } from "../src/bot/config.js";
import { pingCommand } from "../src/bot/commands/ping.js";

test("bot configuration requires a token without exposing its value", () => {
  assert.throws(() => loadBotConfig({}), /DISCORD_TOKEN is required/);
  assert.deepEqual(loadBotConfig({
    DISCORD_TOKEN: " test-token ",
    DISCORD_CLIENT_ID: " app-id ",
    DISCORD_GUILD_ID: " guild-id "
  }), {
    token: "test-token",
    clientId: "app-id",
    guildId: "guild-id"
  });
});

test("command registration requires the application ID", () => {
  assert.throws(() => requireApplicationId({}), /DISCORD_CLIENT_ID is required/);
  assert.equal(requireApplicationId({ clientId: "app-id" }), "app-id");
});

test("command map validates and registers the ping command", () => {
  const map = createCommandMap([pingCommand]);
  assert.equal(map.get("ping"), pingCommand);
  assert.deepEqual(getCommandDefinitions([pingCommand]), [{
    name: "ping",
    description: "Check whether Avero is responding."
  }]);
});

test("command map rejects duplicate command names", () => {
  assert.throws(() => createCommandMap([pingCommand, pingCommand]), /Duplicate command name: ping/);
});

test("ping command uses the shared AveroUI embed style", async () => {
  let response;
  await pingCommand.execute({
    reply: async (payload) => { response = payload; }
  });

  assert.equal(response.embeds[0].title, "Avero • Pong");
  assert.match(response.embeds[0].description, /Discord connection is responding/);
  assert.equal(response.embeds[0].footer.text, "AveroUI • Shared response style");
});
