import test from "node:test";
import assert from "node:assert/strict";
import { createEngaugeClient, EngaugeApiError } from "../src/bot/engauge-api.js";

const serverId = "12345678901234567";
const memberId = "12345678901234568";

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

test("Engauge API errors retain a short sanitized response body", async () => {
  const longBody = "invalid amount " + "x".repeat(400) + " test-token";
  const client = createEngaugeClient({
    token: "test-token",
    fetchImpl: async () => new Response(longBody, { status: 400 })
  });
  await assert.rejects(
    client.addMemberXp(serverId, memberId, 1),
    (error) => {
      assert.ok(error instanceof EngaugeApiError);
      assert.equal(error.status, 400);
      assert.equal(error.committed, false);
      assert.ok(error.responseBody.startsWith("invalid amount "));
      assert.ok(error.responseBody.length <= 300);
      assert.ok(!error.responseBody.includes("test-token"));
      return true;
    }
  );
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


test("Engauge member list uses documented sorting and paging parameters", async () => {
  let captured;
  const client = createEngaugeClient({
    token: "test-token",
    fetchImpl: async (url) => {
      captured = new URL(url);
      return new Response(JSON.stringify([{ id: memberId, xp: "20662", messages: 12, voiceSeconds: 3600, currency: "90" }]), { status: 200 });
    }
  });
  const result = await client.getMembers(serverId, { order: "messages", direction: "asc", start: 5, limit: 20 });
  assert.equal(result[0].id, memberId);
  assert.equal(captured.pathname, "/api/v1/servers/" + serverId + "/members");
  assert.equal(captured.searchParams.get("order"), "messages");
  assert.equal(captured.searchParams.get("direction"), "asc");
  assert.equal(captured.searchParams.get("start"), "5");
  assert.equal(captured.searchParams.get("limit"), "20");
});

test("Engauge getAllMembers walks every page until the final partial page", async () => {
  const starts = [];
  const members = [
    { id: memberId, xp: "300", level: 4 },
    { id: "12345678901234569", xp: "200", level: 3 },
    { id: "12345678901234570", xp: "100", level: 2 }
  ];
  const client = createEngaugeClient({
    token: "test-token",
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      starts.push(parsed.searchParams.get("start"));
      const start = Number(parsed.searchParams.get("start"));
      const limit = Number(parsed.searchParams.get("limit"));
      return new Response(JSON.stringify(members.slice(start, start + limit)), { status: 200 });
    }
  });
  const result = await client.getAllMembers(serverId, { pageSize: 2, order: "xp" });
  assert.deepEqual(starts, ["0", "2"]);
  assert.deepEqual(result.map((member) => member.id), members.map((member) => member.id));
});

test("Engauge member pagination rejects repeated full pages instead of looping forever", async () => {
  const client = createEngaugeClient({
    token: "test-token",
    fetchImpl: async () => new Response(JSON.stringify([
      { id: memberId, xp: "100" },
      { id: "12345678901234569", xp: "90" }
    ]), { status: 200 })
  });
  await assert.rejects(client.getAllMembers(serverId, { pageSize: 2 }), /pagination did not advance/);
});
