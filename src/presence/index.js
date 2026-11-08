import { DiscordIpcClient } from "./discord-client.js";

const clientId = process.env.DISCORD_CLIENT_ID;
if (!clientId) {
  console.error("[Avero RPC] Missing DISCORD_CLIENT_ID. Set it to the Application ID from Discord Developer Portal → General Information.");
  process.exit(1);
}

const client = new DiscordIpcClient({ clientId });
client.start();

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[Avero RPC] Received ${signal}; clearing your personal activity.`);
  client.stop();
}
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
