import test from "node:test";
import assert from "node:assert/strict";
import { tokenizePrefixArguments } from "../src/bot/prefix-router.js";
import { answerAveroQuestion, resetAveroAiCooldownsForTests } from "../src/bot/ai.js";

test("Avero prefix tokenizer preserves quoted multi-word arguments", () => {
  assert.deepEqual(tokenizePrefixArguments('config set "welcome channel" #general'), [
    "config", "set", "welcome channel", "#general"
  ]);
});

test("Avero prefix tokenizer handles single quotes and empty input", () => {
  assert.deepEqual(tokenizePrefixArguments("profile bio 'hello there'"), ["profile", "bio", "hello there"]);
  assert.deepEqual(tokenizePrefixArguments(""), []);
});

test("AI helper gives a setup hint when no Gemini key is configured", async () => {
  resetAveroAiCooldownsForTests();
  const result = await answerAveroQuestion({
    message: { author: { id: "member-1" }, content: "avero hello" },
    commands: [],
    env: {}
  });
  assert.match(result, /GEMINI_API_KEY/);
});
