import { createServer } from "node:http";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, JSON_HEADERS);
  response.end(JSON.stringify(payload));
}

export function createApp({ readinessCheck } = {}) {
  return createServer(async (request, response) => {
    let url;
    try {
      url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          status: "ok",
          service: "avero"
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/ready") {
        if (typeof readinessCheck !== "function") {
          sendJson(response, 503, {
            status: "not_ready",
            service: "avero",
            checks: { database: "not_configured" }
          });
          return;
        }
        await readinessCheck();
        sendJson(response, 200, {
          status: "ready",
          service: "avero",
          checks: { database: "ok" }
        });
        return;
      }

      sendJson(response, 404, {
        error: "Not Found",
        message: "The requested endpoint does not exist."
      });
    } catch (error) {
      if (url?.pathname === "/ready") {
        console.error("Readiness check failed:", error?.message ?? error);
        if (!response.headersSent) {
          sendJson(response, 503, {
            status: "not_ready",
            service: "avero",
            checks: { database: "failed" }
          });
        } else {
          response.destroy();
        }
        return;
      }
      console.error("Request handling failed:", error);
      if (!response.headersSent) {
        sendJson(response, 500, {
          error: "Internal Server Error",
          message: "An unexpected error occurred."
        });
      } else {
        response.destroy();
      }
    }
  });
}
