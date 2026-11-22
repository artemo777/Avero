import assert from "node:assert/strict";
import test from "node:test";
import { matchesAutoResponseRule, normalizeTriggerText, renderAutoResponseTemplate } from "../src/bot/autoresponder/engine.js";
import { validateAutoResponseRule } from "../src/bot/commands/autoresponder.js";
const rule = (overrides = {}) => ({ matchType: "contains", trigger: "hello", caseSensitive: false, ...overrides });
const message = (content, extra = {}) => ({ content, attachments: { size: 0 }, mentions: { users: { size: 0, has: () => false } }, ...extra });
test("normalizes Unicode and case-insensitive text", () => {
  assert.equal(normalizeTriggerText("  HELLO  "), "hello");
  assert.equal(normalizeTriggerText("ＡＢＣ"), "abc");
  assert.equal(normalizeTriggerText("Hello", true), "Hello");
});
test("supports exact, contains, starts-with and ends-with matching", () => {
  assert.equal(matchesAutoResponseRule(rule({ matchType: "exact" }), message("HELLO")), true);
  assert.equal(matchesAutoResponseRule(rule(), message("say hello there")), true);
  assert.equal(matchesAutoResponseRule(rule({ matchType: "starts_with" }), message("hello there")), true);
  assert.equal(matchesAutoResponseRule(rule({ matchType: "ends_with" }), message("say hello")), true);
  assert.equal(matchesAutoResponseRule(rule({ matchType: "exact" }), message("hello there")), false);
});
test("case-sensitive matching respects capitalization", () => {
  assert.equal(matchesAutoResponseRule(rule({ caseSensitive: true }), message("HELLO")), false);
  assert.equal(matchesAutoResponseRule(rule({ caseSensitive: true }), message("hello")), true);
});
test("supports attachment and mention triggers", () => {
  assert.equal(matchesAutoResponseRule(rule({ matchType: "attachment" }), message("", { attachments: { size: 1 } })), true);
  assert.equal(matchesAutoResponseRule(rule({ matchType: "user_mention" }), message("", { mentions: { users: { size: 1, has: () => false } } })), true);
  assert.equal(matchesAutoResponseRule(rule({ matchType: "bot_mention" }), message("", { mentions: { users: { size: 1, has: (id) => id === "bot" } } }), "bot"), true);
});
test("does not match empty text triggers", () => {
  assert.equal(matchesAutoResponseRule(rule({ trigger: "" }), message("anything")), false);
});
test("renders supported placeholders without interpreting unknown tokens", () => {
  const msg = {
    author: { id: "123", username: "Ada", toString: () => "<@123>" }, guildId: "456",
    guild: { name: "Avero", memberCount: 12 }, channel: { name: "general" }, client: { user: { username: "AveroBot" } }
  };
  assert.equal(renderAutoResponseTemplate("Hi {user} ({username}) in {server}/#{channel}: {member_count}", msg), "Hi <@123> (Ada) in Avero/#general: 12");
  assert.equal(renderAutoResponseTemplate("{unknown}", msg), "{unknown}");
});

function fullRule(overrides = {}) {
  return {
    id: "rule-1", guildId: "30000000000000001", name: "hello", matchType: "contains",
    trigger: "hello", responseType: "text", responseContent: "Hi {username}!",
    randomResponses: [], enabled: true, caseSensitive: false, priority: 0, stopOnMatch: true,
    cooldownSeconds: 0, perUserCooldownSeconds: 0, deleteAfterSeconds: 0,
    allowedChannelIds: [], ignoredChannelIds: [], allowedRoleIds: [], ignoredRoleIds: [],
    ...overrides
  };
}
let runtimeGuildCounter = 81000000000000000n;
function runtimeMessage(overrides = {}) {
  const sent = [];
  runtimeGuildCounter += 1n;
  const message = {
    guildId: String(runtimeGuildCounter), channelId: "40000000000000001",
    guild: { name: "Test", memberCount: 5, members: { me: {} } },
    author: { id: "50000000000000001", username: "Ada", bot: false, toString: () => "<@50000000000000001>" },
    member: { roles: { cache: new Set(["60000000000000001"]) } },
    channel: { name: "general", send: async (payload) => { sent.push(payload); return { delete: async () => {} }; }, permissionsFor: () => ({ has: () => true }) },
    client: { user: { id: "70000000000000001", username: "Avero" } },
    mentions: { users: { size: 0, has: () => false } },
    attachments: { size: 0 }, content: "hello",
    ...overrides
  };
  return { message, sent };
}
function runtimePrisma(rules, cooldownRows = []) {
  const logs = [];
  return {
    logs,
    autoResponseRule: { findMany: async () => rules },
    autoResponseLog: { create: async ({ data }) => { logs.push(data); return data; } },
    $transaction: async (callback) => callback({
      autoResponseCooldown: {
        findMany: async () => cooldownRows,
        upsert: async () => ({})
      }
    })
  };
}
test("message handler sends a templated response and records success", async () => {
  const { handleAutoResponseMessage } = await import("../src/bot/autoresponder/engine.js");
  const { message, sent } = runtimeMessage();
  const prisma = runtimePrisma([fullRule()]);
  assert.equal(await handleAutoResponseMessage(message, prisma), 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content, "Hi Ada!");
  assert.deepEqual(sent[0].allowedMentions, { parse: [], users: [message.author.id], roles: [], repliedUser: false });
  assert.equal(prisma.logs[0].status, "sent");
});
test("message handler enforces channel and role restrictions", async () => {
  const { handleAutoResponseMessage } = await import("../src/bot/autoresponder/engine.js");
  const channelCase = runtimeMessage();
  const channelPrisma = runtimePrisma([fullRule({ allowedChannelIds: ["40000000000000002"] })]);
  assert.equal(await handleAutoResponseMessage(channelCase.message, channelPrisma), 0);
  assert.equal(channelCase.sent.length, 0);
  const roleCase = runtimeMessage();
  const rolePrisma = runtimePrisma([fullRule({ allowedRoleIds: ["60000000000000002"] })]);
  assert.equal(await handleAutoResponseMessage(roleCase.message, rolePrisma), 0);
  assert.equal(roleCase.sent.length, 0);
});
test("message handler skips bots and respects active cooldown rows", async () => {
  const { handleAutoResponseMessage } = await import("../src/bot/autoresponder/engine.js");
  const botCase = runtimeMessage({ author: { id: "50000000000000001", username: "Bot", bot: true, toString: () => "<@50000000000000001>" } });
  assert.equal(await handleAutoResponseMessage(botCase.message, runtimePrisma([fullRule()])), 0);
  assert.equal(botCase.sent.length, 0);
  const cooldownCase = runtimeMessage();
  const prisma = runtimePrisma([fullRule({ cooldownSeconds: 60 })], [
    { scopeKey: "__global__", lastTriggeredAt: new Date() }
  ]);
  assert.equal(await handleAutoResponseMessage(cooldownCase.message, prisma), 0);
  assert.equal(cooldownCase.sent.length, 0);
});

test("autoresponder validation explains when a trigger value is required", () => {
  const base = { name: "Welcome", responseContent: "Hello!", matchType: "contains", responseType: "text", trigger: "" };
  assert.throws(() => validateAutoResponseRule(base), /needs a Trigger value/i);
  assert.equal(validateAutoResponseRule({ ...base, matchType: "attachment" }).trigger, "");
  assert.equal(validateAutoResponseRule({ ...base, matchType: "user_mention" }).matchType, "user_mention");
  assert.equal(validateAutoResponseRule({ ...base, matchType: "bot_mention" }).matchType, "bot_mention");
});

test("random autoresponder requires at least two non-empty choices", () => {
  const base = { name: "Random", responseContent: "one", matchType: "attachment", responseType: "random", trigger: "" };
  assert.throws(() => validateAutoResponseRule(base), /at least two choices/i);
  assert.equal(validateAutoResponseRule({ ...base, responseContent: "one || two" }).responseContent, "one || two");
});
