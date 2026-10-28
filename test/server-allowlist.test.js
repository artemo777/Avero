import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedGuild } from "../src/bot/server-allowlist.js";

const lightXGuildId = "1434292419788017766";
const testGuildId = "1563505183382839316";
const allowedGuildIds = [lightXGuildId, testGuildId];

test("allows only the two configured Avero servers", () => {
  assert.equal(isAllowedGuild(lightXGuildId, allowedGuildIds), true);
  assert.equal(isAllowedGuild(testGuildId, allowedGuildIds), true);
  assert.equal(isAllowedGuild("123456789012345678", allowedGuildIds), false);
});

test("blocks direct messages and missing server IDs", () => {
  assert.equal(isAllowedGuild(undefined, allowedGuildIds), false);
  assert.equal(isAllowedGuild(null, allowedGuildIds), false);
  assert.equal(isAllowedGuild("", allowedGuildIds), false);
});

test("an empty allowlist disables Avero in every server", () => {
  assert.equal(isAllowedGuild(lightXGuildId, []), false);
  assert.equal(isAllowedGuild(testGuildId, []), false);
});
