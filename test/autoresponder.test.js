import assert from "node:assert/strict";
import test from "node:test";
import { matchesAutoResponseRule, normalizeTriggerText, renderAutoResponseTemplate } from "../src/bot/autoresponder/engine.js";
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
