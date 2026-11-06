const DEFAULT_BASE_URL = "https://engau.ge";
const ID_PATTERN = /^\d{17,20}$/;

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

export class EngaugeApiError extends Error {
  constructor(message, { status = 0, committed = false, cause } = {}) {
    super(message, { cause });
    this.name = "EngaugeApiError";
    this.status = status;
    this.committed = committed;
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

  async function request(method, path, { amount } = {}) {
    if (!apiToken) throw new EngaugeApiError("ENGAUGE_API_TOKEN is not configured.");
    const url = new URL(root + path);
    if (amount !== undefined) url.searchParams.set("amount", String(amount));
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
    const data = parseJson(response, raw);
    if (!response.ok) {
      // Engauge documents that HTTP 502 can be returned after the XP write has committed.
      throw new EngaugeApiError("Engauge API request failed (HTTP " + response.status + ").", {
        status: response.status,
        committed: method === "POST" && response.status === 502
      });
    }
    return data;
  }

  return Object.freeze({
    getMember(serverId, memberId) {
      const server = requireId(serverId, "serverId");
      const member = requireId(memberId, "memberId");
      return request("GET", "/api/v1/servers/" + server + "/members/" + member);
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
