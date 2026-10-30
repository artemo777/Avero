import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { createCommandMap, getCommandDefinitions } from "../src/bot/command-registry.js";
import { loadBotConfig, requireApplicationId } from "../src/bot/config.js";
import { pingCommand } from "../src/bot/commands/ping.js";
import { helpCommand } from "../src/bot/commands/help.js";
import { profileCommand } from "../src/bot/commands/profile.js";
import { leaderboardCommand } from "../src/bot/commands/leaderboard.js";
import { commands } from "../src/bot/commands/index.js";
import { handleGameComponent, renderGames } from "../src/bot/game-ui.js";

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
    levelRoleRewards: {},
    levelUpChannelId: undefined,
    messageXpCooldownMs: 60_000,
    minMessageXp: 15,
    maxMessageXp: 25
  });
});

test("legacy guild allowlist environment values do not restrict bot configuration", () => {
  const config = loadBotConfig({
    DISCORD_TOKEN: "token",
    AVERO_ALLOWED_GUILD_IDS: "not-a-server-id,anything"
  });
  assert.equal(config.token, "token");
  assert.equal("allowedGuildIds" in config, false);
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

test("command registration requires the application ID for global registration", () => {
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

function panelText(response) {
  return response.components[0].toJSON().components.filter((component) => component.type === 10).map((component) => component.content).join("\n");
}

test("RPS is free to play and rewards wins without wagers", async () => {
  const { rpsCommand } = await import("../src/bot/commands/rps.js");
  let response;
  const account = { guildId: "guild-1", userId: "user-1", balance: 0, lastGameRewardAt: null };
  const transactions = [];
  const prisma = {
    $transaction: async (callback) => callback(prisma),
    currencyTransaction: {
      create: async ({ data }) => { transactions.push(data); return data; }
    },
    currencyAccount: {
      upsert: async () => account,
      updateMany: async ({ where, data }) => {
        if (where.OR && account.lastGameRewardAt !== null) return { count: 0 };
        account.balance += data.balance.increment;
        account.lastGameRewardAt = data.lastGameRewardAt;
        return { count: 1 };
      },
      findUnique: async () => ({ ...account })
    }
  };
  await rpsCommand.execute({
    guildId: "guild-1",
    user: { id: "user-1" },
    options: { getString: () => "rock" },
    reply: async (payload) => { response = payload; }
  }, { prisma });
  assert.equal(response.flags, MessageFlags.IsComponentsV2);
  const text = panelText(response);
  assert.match(text, /DUEL DECK/);
  assert.match(text, /You:/);
  assert.match(text, /Avero:/);
  assert.match(text, /No wagers/i);
  assert.equal(transactions.filter((entry) => entry.type === "rps_reward").length,
    transactions.some((entry) => entry.type === "rps_win") ? 1 : 0);
  assert.ok(response.components[0].toJSON().components.some((component) => component.type === 1));
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
    flags: MessageFlags.Ephemeral
  });

  interaction.guildId = "guild-1";
  await rpsCommand.execute(interaction);
  assert.deepEqual(replies[1], {
    content: "Choose rock, paper, or scissors.",
    flags: MessageFlags.Ephemeral
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
    { content: "Currency can only be used inside a server.", flags: MessageFlags.Ephemeral },
    { content: "Guess can only be played inside a server.", flags: MessageFlags.Ephemeral }
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
    flags: MessageFlags.Ephemeral
  });
});

test("global command list includes new economy features and has no duplicate names", () => {
  const names = commands.map((command) => command.data.name);
  assert.ok(names.includes("games"));
  assert.ok(names.includes("profile"));
  assert.ok(names.includes("leaderboard"));
  assert.ok(names.includes("help"));
  assert.equal(names.length, new Set(names).size);
  assert.ok(names.includes("work"));
  assert.ok(names.includes("contracts"));
  assert.ok(names.includes("achievements"));
  assert.ok(names.includes("vault"));
  assert.ok(names.includes("coinflip"));
  assert.equal(names.length, 19);
});

test("games hub uses a compact Components V2 panel with all game controls", () => {
  const response = renderGames("user-1");
  assert.equal(response.flags, MessageFlags.IsComponentsV2);
  assert.equal(response.files, undefined);
  const panel = response.components[0].toJSON();
  assert.ok(!panel.components.some((component) => component.type === 12));
  const text = panel.components.filter((component) => component.type === 10).map((component) => component.content).join("\n");
  assert.doesNotMatch(text, /A V E R O|AVERO\s*\//);
  assert.match(text, /Guess the number/);
  assert.match(text, /25 coins/);
  assert.match(text, /The Vault/);
  assert.match(text, /Coinflip/);
  assert.match(text, /one code attempt per UTC day and \+25 on a correct solve/);
  assert.doesNotMatch(text, /Tap a button below to play instantly/);
  const rows = panel.components.filter((component) => component.type === 1);
  assert.equal(rows.length, 3);
  assert.equal(rows.reduce((count, row) => count + row.components.length, 0), 11);
});

test("help command groups the real commands into compact embeds", async () => {
  let response;
  await helpCommand.execute({ reply: async (payload) => { response = payload; } });
  assert.equal(response.embeds.length, 1);
  assert.equal(response.embeds[0].title, "Avero commands");
  assert.equal(response.embeds[0].fields.length, 4);
  assert.match(response.embeds[0].fields[0].value, /\/balance/);
  assert.match(response.embeds[0].fields[2].value, /\/leaderboard/);
  assert.match(response.embeds[0].fields[2].value, /achievements/);
  assert.match(response.embeds[0].fields[1].value, /vault/);
});

test("profile command combines wallet, XP, and collection data", async () => {
  let response;
  const prisma = {
    currencyAccount: { findUnique: async () => ({ balance: 1250 }) },
    currencyPurchase: { findMany: async () => [{ itemId: "neon_badge" }] },
    memberProfile: { findUnique: async () => ({ xp: 500 }) },
    currencyTransaction: { groupBy: async () => [] }
  };
  await profileCommand.execute({
    guildId: "guild-1",
    guild: { name: "Test Server" },
    user: { id: "user-1", username: "Ada" },
    options: { getUser: () => null },
    reply: async (payload) => { response = payload; }
  }, { prisma });

  assert.equal(response.embeds[0].title, "Ada");
  assert.equal(response.files, undefined);
  assert.equal(response.embeds[0].fields.find((field) => field.name === "Equipped badge").value, "None");
  assert.equal(response.embeds[0].fields[0].value, "1,250 coins");
  assert.equal(response.embeds[0].fields[1].value, "2");
  assert.equal(response.embeds[0].fields[2].value, "1 / 6");
});


test("profile lists all owned badges but displays only the selected badge beside the username", async () => {
  let response;
  const prisma = {
    currencyAccount: { findUnique: async () => ({ balance: 250 }) },
    currencyPurchase: { findMany: async () => [{ itemId: "neon_badge" }, { itemId: "prism_crown" }] },
    memberProfile: { findUnique: async () => ({ xp: 0, equippedBadgeItemId: "prism_crown" }) },
    currencyTransaction: { groupBy: async () => [] }
  };
  await profileCommand.execute({
    guildId: "guild-1",
    guild: { name: "Test Server" },
    user: { id: "user-1", username: "Ada" },
    options: { getUser: () => null },
    reply: async (payload) => { response = payload; }
  }, { prisma });
  assert.equal(response.embeds[0].author.name, "Ada");
  assert.equal(response.embeds[0].author.icon_url, "attachment://profile-badge.png");
  assert.equal(response.files.length, 1);
  assert.equal(response.files[0].name, "profile-badge.png");
  assert.equal(response.embeds[0].fields.find((field) => field.name === "Equipped badge").value, "Prism Crown");
  assert.match(response.embeds[0].fields.find((field) => field.name === "Badges").value, /Neon Badge, Prism Crown/);
});

test("profile shows the actual equipped collectible artwork beside the username", async () => {
  let response;
  const prisma = {
    currencyAccount: { findUnique: async () => ({ balance: 250 }) },
    currencyPurchase: { findMany: async () => [{ itemId: "prism_crown" }] },
    memberProfile: { findUnique: async () => ({ xp: 0, level: 0, equippedBadgeItemId: "prism_crown" }) },
    currencyTransaction: { groupBy: async () => [] }
  };
  await profileCommand.execute({
    guildId: "guild-1",
    guild: { name: "Test Server" },
    user: { id: "user-1", username: "Ada" },
    options: { getUser: () => null },
    reply: async (payload) => { response = payload; }
  }, { prisma });

  assert.equal(response.embeds[0].author.name, "Ada");
  assert.equal(response.embeds[0].author.icon_url, "attachment://profile-badge.png");
  assert.equal(response.files.length, 1);
  assert.equal(response.files[0].name, "profile-badge.png");
  assert.equal(response.embeds[0].title, undefined);
});

test("leaderboard sorts server members by the requested category", async () => {
  let response;
  const prisma = {
    currencyAccount: {
      findMany: async (query) => {
        assert.equal(query.where.guildId, "guild-1");
        assert.deepEqual(query.orderBy, { balance: "desc" });
        return [
          { userId: "user-1", balance: 900 },
          { userId: "user-2", balance: 450 }
        ];
      }
    },
    memberProfile: { findMany: async () => { throw new Error("XP query should not run"); } }
  };
  await leaderboardCommand.execute({
    guildId: "guild-1",
    options: { getString: () => "coins" },
    reply: async (payload) => { response = payload; }
  }, { prisma });

  assert.equal(response.embeds[0].title, "🪙 Coin leaderboard");
  assert.match(response.embeds[0].description, /<@user-1> — \*\*900 coins\*\*/);
  assert.match(response.embeds[0].description, /<@user-2> — \*\*450 coins\*\*/);
});


test("daily Vault button opens the current puzzle clues from the games hub", async () => {
  let response;
  const handled = await handleGameComponent({
    customId: "avero|user-1|vault",
    user: { id: "user-1" },
    guildId: "guild-1",
    reply: async (payload) => { response = payload; },
    update: async (payload) => { response = payload; }
  }, { prisma: {} });
  assert.equal(handled, true);
  const text = panelText(response);
  assert.match(text, /Today's vault is ready/);
  assert.match(text, /Daily three-dial puzzle/);
});
