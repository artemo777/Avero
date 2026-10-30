import test from "node:test";
import assert from "node:assert/strict";
import { requireApplicationId } from "../src/bot/config.js";

test("global command registration requires an application ID", () => {
  assert.throws(() => requireApplicationId({}), /DISCORD_CLIENT_ID/);
  assert.throws(() => requireApplicationId({ clientId: "  " }), /DISCORD_CLIENT_ID/);
  assert.equal(requireApplicationId({ clientId: "application-id" }), "application-id");
});
