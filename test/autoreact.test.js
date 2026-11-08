import assert from "node:assert/strict";
import test from "node:test";
import { handleAutoReactionMessage, normalizeReactionEmoji } from "../src/bot/auto-reactions.js";

let nextGuildId = 10000000000000000n;
function makePrisma({ enabled = true, ignoredChannelIds = [], perks = [] } = {}) {
  return {
    autoReactionSetting: {
      upsert: async () => ({
        guildId: String(nextGuildId),
        emoji: null,
        enabled,
        ignoredChannelIds
      })
    },
    autoReactionRolePerk: {
      findMany: async () => perks
    }
  };
}
function makeMessage({
  mentions = 1,
  roles = [],
  existingReactions = [],
  permission = true,
  bot = false,
  webhookId = null,
  system = false,
  channelId = "20000000000000001"
} = {}) {
  nextGuildId += 1n;
  const added = [];
  return {
    added,
    message: {
      guildId: String(nextGuildId),
      guild: { members: { me: {} } },
      author: { bot },
      webhookId,
      system,
      channelId,
      member: { roles: { cache: new Set(roles) } },
      mentions: { users: { size: mentions } },
      reactions: { cache: existingReactions },
      channel: { permissionsFor: () => ({ has: () => permission }) },
      react: async (emoji) => { added.push(emoji); }
    }
  };
}

test("accepts a single Unicode emoji, flags and keycaps", () => {
  assert.deepEqual(normalizeReactionEmoji("🔥"), { kind: "unicode", value: "🔥" });
  assert.equal(normalizeReactionEmoji("🇩🇰").kind, "unicode");
  assert.equal(normalizeReactionEmoji("1️⃣").kind, "unicode");
});

test("accepts server custom emoji syntax", () => {
  assert.deepEqual(normalizeReactionEmoji("<:avero:12345678901234567>"), {
    kind: "custom",
    id: "12345678901234567",
    value: "<:avero:12345678901234567>"
  });
});

test("rejects text, multiple emoji and malformed custom emoji", () => {
  assert.throws(() => normalizeReactionEmoji("hello"), /standard emoji/);
  assert.throws(() => normalizeReactionEmoji("🔥😂"), /exactly one emoji/);
  assert.throws(() => normalizeReactionEmoji("🔥 hello"), /one emoji/);
  assert.throws(() => normalizeReactionEmoji("<:outside:123>"), /standard emoji/);
});

test("does nothing on messages without actual user mentions", async () => {
  const { message, added } = makeMessage({ mentions: 0, roles: ["staff"] });
  const prisma = makePrisma({ perks: [{ roleId: "staff", emoji: "🛡️" }] });
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    assert.equal(await handleAutoReactionMessage(message, prisma), false);
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(added, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /needs Add Reactions/);
});

test("adds every matching role emoji to a user-mention message", async () => {
  const { message, added } = makeMessage({ roles: ["staff", "booster"] });
  const prisma = makePrisma({
    perks: [
      { roleId: "staff", emoji: "🛡️" },
      { roleId: "booster", emoji: "💎" },
      { roleId: "donor", emoji: "💰" }
    ]
  });
  assert.equal(await handleAutoReactionMessage(message, prisma), true);
  assert.deepEqual(added, ["🛡️", "💎"]);
});

test("adds duplicate emoji only once when multiple roles share it", async () => {
  const { message, added } = makeMessage({ roles: ["staff", "helper"] });
  const prisma = makePrisma({
    perks: [
      { roleId: "staff", emoji: "⭐" },
      { roleId: "helper", emoji: "⭐" }
    ]
  });
  assert.equal(await handleAutoReactionMessage(message, prisma), true);
  assert.deepEqual(added, ["⭐"]);
});

test("does not react when the feature is disabled or the channel is ignored", async () => {
  const disabled = makeMessage({ roles: ["staff"] });
  assert.equal(await handleAutoReactionMessage(
    disabled.message,
    makePrisma({ enabled: false, perks: [{ roleId: "staff", emoji: "🛡️" }] })
  ), false);
  assert.deepEqual(disabled.added, []);

  const ignored = makeMessage({ roles: ["staff"] });
  assert.equal(await handleAutoReactionMessage(
    ignored.message,
    makePrisma({ ignoredChannelIds: [ignored.message.channelId], perks: [{ roleId: "staff", emoji: "🛡️" }] })
  ), false);
  assert.deepEqual(ignored.added, []);
});

test("does not add an emoji already applied by Avero", async () => {
  const existing = { me: true, emoji: { toString: () => "🛡️" } };
  const { message, added } = makeMessage({ roles: ["staff"], existingReactions: [existing] });
  const prisma = makePrisma({ perks: [{ roleId: "staff", emoji: "🛡️" }, { roleId: "staff2", emoji: "💎" }] });
  assert.equal(await handleAutoReactionMessage(message, prisma), false);
  assert.deepEqual(added, []);
});

test("skips reaction attempts and reports missing Add Reactions permission", async () => {
  const { message, added } = makeMessage({ roles: ["staff"], permission: false });
  const prisma = makePrisma({ perks: [{ roleId: "staff", emoji: "🛡️" }] });
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    assert.equal(await handleAutoReactionMessage(message, prisma), false);
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(added, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /needs Add Reactions/);
});
