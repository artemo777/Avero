import test from "node:test";
import assert from "node:assert/strict";
import { buildDiagnosticsPanel } from "../src/bot/commands/config.js";

test("diagnostics panel reports server-scoped delivery and automation health", async () => {
  const prisma = {
    activityXpAward: { count: async ({ where }) => where.status === "needs_review" ? 2 : 1 },
    activityRewardClaim: { count: async () => 3 },
    autoResponseRule: { count: async () => 4 },
    activityBoardSetting: { findUnique: async () => ({ dailyChannelId: "daily", weeklyChannelId: null, updateIntervalSeconds: 300 }) }
  };
  const payload = await buildDiagnosticsPanel(prisma, "guild-1", "Test Server");
  const content = payload.components[0].toJSON().components.filter((part) => part.type === 10).map((part) => part.content).join("\n");
  assert.match(content, /Pending · 1/);
  assert.match(content, /Needs review · 2/);
  assert.match(content, /Rejected · 1/);
  assert.match(content, /Claims requiring XP review · 3/);
  assert.match(content, /Enabled autoresponder rules · 4/);
  assert.match(content, /Daily channel · Configured/);
  assert.match(content, /Weekly channel · Not configured/);
});
