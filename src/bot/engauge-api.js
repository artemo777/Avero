const DEFAULT_BASE_URL = "https://engau.ge";
const ID_PATTERN = /^\d{17,20}$/;
const ERROR_BODY_LIMIT = 300;
const MEMBER_ORDERS = new Set(["xp", "currency", "messages", "voice"]);
const MEMBER_DIRECTIONS = new Set(["asc", "desc"]);

function requireId(value, name) {
  const id = String(value ?? "");
  if (!ID_PATTERN.test(id)) throw new TypeError(name + " must be a valid Discord snowflake.");
  return id;
}

function parseJson(response, body) {
  if (!body) return null;
  try { return JSON.parse(body); }
  catch { throw new Error("Engauge returned a non-JSON response (HTTP " + response.status + ")."); }
}

function safeErrorBody(body, token) {
  return String(body ?? "")
    .replaceAll(token, "[redacted]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ERROR_BODY_LIMIT);
}

export class EngaugeApiError extends Error {
  constructor(message, { status = 0, committed = false, responseBody = "", cause } = {}) {
    super(message, { cause });
    this.name = "EngaugeApiError";
    this.status = status;
    this.committed = committed;
    this.responseBody = responseBody;
  }
}

export function createEngaugeClient({
  token = process.env.ENGAUGE_API_TOKEN,
  baseUrl = process.env.ENGAUGE_API_BASE_URL || DEFAULT_BASE_URL,
  authHeader = process.env.ENGAUGE_API_AUTH_HEADER || "Authorization",
  authScheme = process.env.ENGAUGE_API_AUTH_SCHEME ?? "Bearer",
  fetchImpl = globalThis.fetch
} = {}) {
  const apiToken = typeof token === "string" ? token.trim() : "";
  const root = String(baseUrl).replace(/\/+$/, "");
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  if (!/^https:\/\//i.test(root)) throw new TypeError("Engauge API base URL must use HTTPS.");
  if (!/^[A-Za-z0-9-]+$/.test(authHeader)) throw new TypeError("Engauge auth header name is invalid.");

  async function request(method, path, { amount, query } = {}) {
    if (!apiToken) throw new EngaugeApiError("ENGAUGE_API_TOKEN is not configured.");
    const url = new URL(root + path);
    if (amount !== undefined) url.searchParams.set("amount", String(amount));
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    const authValue = authScheme ? authScheme + " " + apiToken : apiToken;
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: { [authHeader]: authValue, Accept: "application/json" }
      });
    } catch (cause) {
      throw new EngaugeApiError("Could not reach the Engauge API; delivery outcome is unknown.", { cause });
    }
    const raw = await response.text().catch(() => "");
    if (!response.ok) {
      // Engauge documents that HTTP 502 can be returned after the XP write has committed.
      throw new EngaugeApiError("Engauge API request failed (HTTP " + response.status + ").", {
        status: response.status,
        committed: method === "POST" && response.status === 502,
        responseBody: safeErrorBody(raw, apiToken)
      });
    }
    return parseJson(response, raw);
  }

  function validateMemberQuery({ order = "xp", direction = "desc", start = 0, limit = 50, name = "" } = {}) {
    if (!MEMBER_ORDERS.has(order)) throw new TypeError("Engauge member order must be xp, currency, messages, or voice.");
    if (!MEMBER_DIRECTIONS.has(direction)) throw new TypeError("Engauge member direction must be asc or desc.");
    if (!Number.isSafeInteger(start) || start < 0) throw new RangeError("Engauge member start must be a non-negative integer.");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new RangeError("Engauge member limit must be from 1 to 50.");
    return { order, direction, start, limit, name: String(name ?? "").trim() };
  }

  return Object.freeze({
    getMember(serverId, memberId) {
      const server = requireId(serverId, "serverId");
      const member = requireId(memberId, "memberId");
      return request("GET", "/api/v1/servers/" + server + "/members/" + member);
    },
    getMembers(serverId, options = {}) {
      const server = requireId(serverId, "serverId");
      const query = validateMemberQuery(options);
      return request("GET", "/api/v1/servers/" + server + "/members", { query });
    },
    async getAllMembers(serverId, options = {}) {
      const server = requireId(serverId, "serverId");
      const { order = "xp", direction = "desc", name = "", pageSize = 50 } = options;
      if (!MEMBER_ORDERS.has(order)) throw new TypeError("Engauge member order must be xp, currency, messages, or voice.");
      if (!MEMBER_DIRECTIONS.has(direction)) throw new TypeError("Engauge member direction must be asc or desc.");
      if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
        throw new RangeError("Engauge member pageSize must be from 1 to 50.");
      }
      const all = [];
      const seen = new Set();
      for (let start = 0; ; start += pageSize) {
        const page = await request("GET", "/api/v1/servers/" + server + "/members", {
          query: validateMemberQuery({ order, direction, start, limit: pageSize, name })
        });
        if (!Array.isArray(page)) {
          throw new Error("Engauge returned an unexpected member-list response.");
        }
        for (const member of page) {
          const id = String(member?.id ?? "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          all.push(member);
        }
        if (page.length < pageSize) break;
        if (all.length === 0 || page.every((member) => !member?.id || !seen.has(String(member.id)))) {
          throw new Error("Engauge member pagination did not advance.");
        }
      }
      return all;
    },
    addMemberXp(serverId, memberId, amount) {
      const server = requireId(serverId, "serverId");
      const member = requireId(memberId, "memberId");
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000) {
        throw new RangeError("XP amount must be an integer from 1 to 1,000,000.");
      }
      return request("POST", "/api/v1/servers/" + server + "/members/" + member + "/xp", { amount });
    }
  });
}

export { DEFAULT_BASE_URL as ENGAUGE_API_DEFAULT_BASE_URL };
