import { createServer } from "node:http";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, JSON_HEADERS);
  response.end(JSON.stringify(payload));
}

export function createApp() {
  return createServer((request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          status: "ok",
          service: "avero"
        });
        return;
      }

      sendJson(response, 404, {
        error: "Not Found",
        message: "The requested endpoint does not exist."
      });
    } catch (error) {
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
