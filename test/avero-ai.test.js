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

test("AI answers ordinary questions without limiting itself to the command catalogue", async () => {
  resetAveroAiCooldownsForTests();
  let requestBody;
  const result = await answerAveroQuestion({
    message: { author: { id: "member-math" }, content: "avero what's 2+2?" },
    commands: [{ data: { name: "balance", description: "Check balance.", options: [] } }],
    env: { GEMINI_API_KEY: "test-key" },
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "4" }] } }] }) };
    }
  });
  assert.equal(result, "4");
  assert.match(requestBody.systemInstruction.parts[0].text, /not limited to Discord commands/i);
  assert.doesNotMatch(requestBody.systemInstruction.parts[0].text, /Only answer questions about the command catalogue/i);
  assert.equal(requestBody.tools, undefined);
});

test("explicit remember requests are saved against the invoking Discord user", async () => {
  resetAveroAiCooldownsForTests();
  const rows = [];
  const prisma = {
    aiMemory: {
      findMany: async () => [],
      findUnique: async () => null,
      count: async () => rows.length,
      upsert: async ({ create }) => {
        const row = { id: "memory-1", ...create, createdAt: new Date(), updatedAt: new Date() };
        rows.push(row);
        return row;
      },
      deleteMany: async () => ({ count: 0 })
    }
  };
  let call = 0;
  const result = await answerAveroQuestion({
    message: { author: { id: "discord-user-123" }, content: "avero remember that I prefer Swedish" },
    env: { GEMINI_API_KEY: "test-key" },
    prisma,
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.ok(body.tools?.[0]?.functionDeclarations.some((entry) => entry.name === "save_memory"));
      call += 1;
      if (call === 1) {
        return { ok: true, json: async () => ({ candidates: [{ content: {
          role: "model",
          parts: [{ functionCall: { name: "save_memory", args: { content: "Prefers Swedish", category: "language" } } }]
        } }] }) };
      }
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "I'll use Swedish in future conversations." }] } }] }) };
    }
  });
  assert.equal(result, "I'll use Swedish in future conversations.");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].userId, "discord-user-123");
  assert.equal(rows[0].content, "Prefers Swedish");
});
