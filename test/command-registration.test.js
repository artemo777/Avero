import test from "node:test";
import assert from "node:assert/strict";
import { requireApplicationId, requireGuildId } from "../src/bot/config.js";

test("test-server registration requires a guild ID before changing commands", () => {
  assert.throws(
    () => requireGuildId({ clientId: "application-id" }),
    /DISCORD_GUILD_ID.*No commands were changed/
  );
  assert.throws(() => requireGuildId({ guildId: "  " }), /DISCORD_GUILD_ID/);
});

test("test-server registration returns the configured guild ID", () => {
  assert.equal(requireGuildId({ guildId: "123456789012345678" }), "123456789012345678");
});

test("command registration still requires an application ID", () => {
  assert.throws(() => requireApplicationId({}), /DISCORD_CLIENT_ID/);
  assert.equal(requireApplicationId({ clientId: "application-id" }), "application-id");
});
