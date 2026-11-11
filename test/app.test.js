import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

async function withServer(t, options = {}) {
  const server = createApp(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return "http://127.0.0.1:" + server.address().port;
}

test("health endpoint returns a healthy JSON response", async (t) => {
  const baseUrl = await withServer(t);
  const response = await fetch(baseUrl + "/health");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "avero"
  });
});

test("readiness endpoint confirms the database check", async (t) => {
  let checks = 0;
  const baseUrl = await withServer(t, { readinessCheck: async () => { checks += 1; } });
  const response = await fetch(baseUrl + "/ready");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ready",
    service: "avero",
    checks: { database: "ok" }
  });
  assert.equal(checks, 1);
});

test("readiness endpoint returns 503 when the database is unavailable", async (t) => {
  const baseUrl = await withServer(t, { readinessCheck: async () => { throw new Error("database offline"); } });
  const response = await fetch(baseUrl + "/ready");

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "not_ready",
    service: "avero",
    checks: { database: "failed" }
  });
});

test("readiness endpoint is unavailable when no check is configured", async (t) => {
  const baseUrl = await withServer(t);
  const response = await fetch(baseUrl + "/ready");

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "not_ready",
    service: "avero",
    checks: { database: "not_configured" }
  });
});

test("unknown routes return 404 JSON", async (t) => {
  const baseUrl = await withServer(t);
  const response = await fetch(baseUrl + "/missing");

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Not Found");
});

test("configuration defaults to port 3000", () => {
  assert.deepEqual(loadConfig({}), { port: 3000 });
});

test("configuration rejects an invalid port", () => {
  assert.throws(() => loadConfig({ PORT: "70000" }), /PORT must be an integer/);
});
