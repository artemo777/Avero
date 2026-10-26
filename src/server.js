import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`Configuration error: ${error.message}`);
  process.exit(1);
}

const server = createApp();

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Avero listening on http://localhost:${config.port}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}; shutting down...`);
  server.close((error) => {
    if (error) {
      console.error("Shutdown failed:", error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
