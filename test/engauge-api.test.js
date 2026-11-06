import test from "node:test";
import assert from "node:assert/strict";
import { createEngaugeClient, EngaugeApiError } from "../src/bot/engauge-api.js";

const serverId = "1434292419788017766";
const memberId = "1563451996512583713";

test("Engauge member lookup uses the documented member endpoint", async () => {
  let captured;
  const client = createEngaugeClient({
    token: "test-token",
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify({ id: memberId, xp: "20662", level: 99 }), { status: 200 });
    }
  });
  const result = await client.getMember(serverId, memberId);
  assert.equal(result.xp, "20662");
  assert.equal(captured.url, "https://engau.ge/api/v1/servers/" + serverId + "/members/" + memberId);
  assert.equal(captured.options.method, "GET");
  assert.equal(captured.options.headers.Authorization, "Bearer test-token");
});

test("Engauge XP award sends the documented amount query parameter", async () => {
  let captured;
  const client = createEngaugeClient({
    token: "test-token",
    fetchImpl: async (url, options) => {
      captured = { url: new URL(url), options };
      return new Response(JSON.stringify({ xp: "20682", level: 99 }), { status: 200 });
    }
  });
  await client.addMemberXp(serverId, memberId, 20);
  assert.equal(captured.url.pathname, "/api/v1/servers/" + serverId + "/members/" + memberId + "/xp");
  assert.equal(captured.url.searchParams.get("amount"), "20");
  assert.equal(captured.options.method, "POST");
});

test("Engauge 502 XP response is marked committed to prevent duplicate rewards", async () => {
  const client = createEngaugeClient({
    token: "test-token",
    fetchImpl: async () => new Response("{}", { status: 502 })
  });
  await assert.rejects(
    client.addMemberXp(serverId, memberId, 20),
    (error) => error instanceof EngaugeApiError && error.status === 502 && error.committed
  );
});

test("Engauge client rejects unsafe inputs and missing token", async () => {
  const client = createEngaugeClient({ token: "", fetchImpl: async () => new Response("{}", { status: 200 }) });
  await assert.rejects(client.getMember(serverId, memberId), /ENGAUGE_API_TOKEN/);
  const ready = createEngaugeClient({ token: "x", fetchImpl: async () => new Response("{}", { status: 200 }) });
  assert.throws(() => ready.addMemberXp(serverId, memberId, 0), /XP amount/);
  assert.throws(() => ready.getMember("not-a-server", memberId), /serverId/);
});
