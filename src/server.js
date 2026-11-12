import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { disconnectPrismaClient, getPrismaClient } from "./db/client.js";

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`Configuration error: ${error.message}`);
  process.exit(1);
}

const server = createApp({
  readinessCheck: async () => {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
  }
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Avero listening on http://localhost:${config.port}`);
});

const SHUTDOWN_GRACE_PERIOD_MS = 10_000;
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down...`);

  const forceCloseTimer = setTimeout(() => {
    console.error("HTTP shutdown grace period expired; closing remaining connections.");
    server.closeAllConnections();
  }, SHUTDOWN_GRACE_PERIOD_MS);
  forceCloseTimer.unref();

  server.close(async (error) => {
    clearTimeout(forceCloseTimer);

    if (error) {
      console.error("HTTP server shutdown failed:", error);
    }

    try {
      await disconnectPrismaClient();
    } catch (disconnectError) {
      console.error("Database disconnect failed:", disconnectError);
      process.exitCode = 1;
    }

    if (error) process.exitCode = 1;
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
