import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { createCommandMap, getCommandDefinitions } from "../src/bot/command-registry.js";
import { loadBotConfig, requireApplicationId, requireCommandRegistrationGuildIds } from "../src/bot/config.js";
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
    allowedGuildIds: [],
    levelRoleRewards: {},
    levelUpChannelId: undefined,
    messageXpCooldownMs: 60_000,
    minMessageXp: 15,
    maxMessageXp: 25
  });
});

test("server allowlist accepts at most two explicit Discord server IDs for the whole bot", () => {
  const config = loadBotConfig({
    DISCORD_TOKEN: "token",
    AVERO_ALLOWED_GUILD_IDS: "123456789012345678, 234567890123456789"
  });
  assert.deepEqual(config.allowedGuildIds, ["123456789012345678", "234567890123456789"]);
  assert.throws(() => loadBotConfig({
    DISCORD_TOKEN: "token",
    AVERO_ALLOWED_GUILD_IDS: "not-a-server-id"
  }), /AVERO_ALLOWED_GUILD_IDS/);
  assert.throws(() => loadBotConfig({
    DISCORD_TOKEN: "token",
    AVERO_ALLOWED_GUILD_IDS: "123456789012345678,123456789012345678"
  }), /duplicate/);
  assert.throws(() => loadBotConfig({
    DISCORD_TOKEN: "token",
    AVERO_ALLOWED_GUILD_IDS: "123456789012345678,234567890123456789,345678901234567890"
  }), /at most two servers/);
});

test("leveling settings are configurable and validated", () => {
  const config = loadBotConfig({
    DISCORD_TOKEN: "token",
    LEVEL_UP_CHANNEL_ID: "123456789012345678",
    LEVEL_XP_COOLDOWN_MS: "90000",
    LEVEL_MIN_MESSAGE_XP: "8",
    LEVEL_MAX_MESSAGE_XP: "18"
  });
  assert.equal(config.levelUpChannelId, "123456789012345678");
  assert.equal(config.messageXpCooldownMs, 90_000);
  assert.equal(config.minMessageXp, 8);
  assert.equal(config.maxMessageXp, 18);
  assert.throws(() => loadBotConfig({ DISCORD_TOKEN: "token", LEVEL_UP_CHANNEL_ID: "not-a-channel" }), /LEVEL_UP_CHANNEL_ID/);
  assert.throws(() => loadBotConfig({ DISCORD_TOKEN: "token", LEVEL_MIN_MESSAGE_XP: "30", LEVEL_MAX_MESSAGE_XP: "10" }), /greater than or equal/);
  assert.throws(() => loadBotConfig({ DISCORD_TOKEN: "token", LEVEL_XP_COOLDOWN_MS: "0" }), /positive safe integer/);
});

test("command registration requires the application ID", () => {
  assert.throws(() => requireApplicationId({}), /DISCORD_CLIENT_ID is required/);
  assert.equal(requireApplicationId({ clientId: "app-id" }), "app-id");
});

test("command registration is limited to the explicit allowlist and never global", () => {
  assert.throws(() => requireCommandRegistrationGuildIds({ allowedGuildIds: [] }), /global command registration is disabled/);
  assert.deepEqual(requireCommandRegistrationGuildIds({
    allowedGuildIds: ["1434292419788017766", "1563505183382839316"]
  }), ["1434292419788017766", "1563505183382839316"]);
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

test("RPS returns a private no-coins result", async () => {
  const { rpsCommand } = await import("../src/bot/commands/rps.js");
  let response;
  await rpsCommand.execute({
    guildId: "guild-1",
    options: { getString: () => "rock" },
    reply: async (payload) => { response = payload; }
  });
  assert.equal(response.ephemeral, true);
  assert.match(response.embeds[0].title, /Rock, Paper, Scissors/);
  assert.match(response.embeds[0].description, /You:/);
  assert.match(response.embeds[0].description, /Avero:/);
  assert.match(response.embeds[0].footer.text, /no coins involved/i);
});

test("RPS rejects direct messages and invalid choices", async () => {
  const { rpsCommand } = await import("../src/bot/commands/rps.js");
  const replies = [];
  const interaction = {
    guildId: null,
    options: { getString: () => "coinflip" },
    reply: async (payload) => { replies.push(payload); }
  };
  await rpsCommand.execute(interaction);
  assert.deepEqual(replies[0], {
    content: "Games can only be played inside a server.",
    ephemeral: true
  });

  interaction.guildId = "guild-1";
  await rpsCommand.execute(interaction);
  assert.deepEqual(replies[1], {
    content: "Choose rock, paper, or scissors.",
    ephemeral: true
  });
});


test("daily and guess commands reject direct messages privately", async () => {
  const { dailyCommand } = await import("../src/bot/commands/daily.js");
  const { guessCommand } = await import("../src/bot/commands/guess.js");
  const replies = [];
  const interaction = {
    guildId: null,
    user: { id: "user-1" },
    options: { getInteger: () => 3 },
    reply: async (payload) => { replies.push(payload); }
  };

  await dailyCommand.execute(interaction, { prisma: {} });
  await guessCommand.execute(interaction, { prisma: {} });

  assert.deepEqual(replies, [
    { content: "Currency can only be used inside a server.", ephemeral: true },
    { content: "Guess can only be played inside a server.", ephemeral: true }
  ]);
});

test("guess command rejects out-of-range input before touching the database", async () => {
  const { guessCommand } = await import("../src/bot/commands/guess.js");
  let response;
  await guessCommand.execute({
    guildId: "guild-1",
    user: { id: "user-1" },
    options: { getInteger: () => 6 },
    reply: async (payload) => { response = payload; }
  }, { prisma: {} });

  assert.deepEqual(response, {
    content: "Choose a whole number from 1 to 5.",
    ephemeral: true
  });
});
