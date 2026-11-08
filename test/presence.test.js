import test from "node:test";
import assert from "node:assert/strict";
import { buildActivity } from "../src/presence/activity.js";
import { getIpcCandidates } from "../src/presence/discord-client.js";

test("builds a developer-themed personal activity with a live start timestamp", () => {
  const activity = buildActivity({}, 1_700_000_000_000);
  assert.equal(activity.type, 0);
  assert.equal(activity.details, "Compiling reality");
  assert.equal(activity.state, "iℏ ∂ψ/∂t = Ĥψ");
  assert.deepEqual(activity.timestamps, { start: 1_700_000_000 });
  assert.equal(activity.assets, undefined);
});

test("only includes uploaded image keys when configured", () => {
  const activity = buildActivity({
    AVERO_RPC_LARGE_IMAGE: "avero_terminal",
    AVERO_RPC_LARGE_TEXT: "Avero IDE",
    AVERO_RPC_SMALL_IMAGE: "vscode"
  });
  assert.deepEqual(activity.assets, {
    large_image: "avero_terminal",
    large_text: "Avero IDE",
    small_image: "vscode",
    small_text: "Debugging the universe"
  });
});

test("only accepts HTTPS activity button URLs", () => {
  const safe = buildActivity({
    AVERO_RPC_BUTTON_LABEL: "Source code",
    AVERO_RPC_BUTTON_URL: "https://github.com/artemo777/Avero"
  });
  assert.deepEqual(safe.buttons, [{ label: "Source code", url: "https://github.com/artemo777/Avero/" }]);

  const unsafe = buildActivity({
    AVERO_RPC_BUTTON_LABEL: "Open",
    AVERO_RPC_BUTTON_URL: "javascript:alert(1)"
  });
  assert.equal(unsafe.buttons, undefined);
});

test("discovers Windows Discord named-pipe candidates", () => {
  const candidates = getIpcCandidates("win32", {}, "C:\\Users\\example");
  assert.equal(candidates.length, 10);
  assert.equal(candidates[0], "\\\\?\\pipe\\discord-ipc-0");
});
