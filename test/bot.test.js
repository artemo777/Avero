import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
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
    guildId: "guild-id",
    levelRoleRewards: {}
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
    description: "Check Avero's connection and response latency."
  }]);
});

test("command map rejects duplicate command names", () => {
  assert.throws(() => createCommandMap([pingCommand, pingCommand]), /Duplicate command name: ping/);
});

test("ping command uses a compact shared AveroUI Components V2 panel", async () => {
  let response;
  await pingCommand.execute({
    createdTimestamp: Date.now(),
    client: { ws: { ping: 38 } },
    reply: async (payload) => { response = payload; }
  });

  assert.equal(response.flags, MessageFlags.IsComponentsV2);
  const panel = response.components[0].toJSON();
  assert.equal(panel.type, 17);
  assert.equal(panel.accent_color, 0x2DD4BF);
  assert.equal(panel.components.length, 1);
  assert.match(panel.components[0].content, /Pong/);
  assert.match(panel.components[0].content, /Interaction/);
});
