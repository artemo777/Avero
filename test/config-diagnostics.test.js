import test from "node:test";
import assert from "node:assert/strict";
import { buildDiagnosticsPanel } from "../src/bot/commands/config.js";

test("diagnostics panel reports autoresponder health without progression systems", async () => {
  const prisma = { autoResponseRule: { count: async () => 4 } };
  const payload = await buildDiagnosticsPanel(prisma, "guild-1", "Test Server");
  const content = payload.components[0].toJSON().components.filter((part) => part.type === 10).map((part) => part.content).join("\n");
  assert.match(content, /Enabled autoresponder rules · 4/);
  assert.doesNotMatch(content, /XP|leaderboard|activity board/i);
});
