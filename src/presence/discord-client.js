import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { buildActivity } from "./activity.js";

const VERSION = 1;
const OP = Object.freeze({ HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 });
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

function encode(opcode, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(8);
  header.writeInt32LE(opcode, 0);
  header.writeInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

export function getIpcCandidates(platform = process.platform, env = process.env, home = os.homedir()) {
  if (platform === "win32") {
    return Array.from({ length: 10 }, (_, index) => `\\\\?\\pipe\\discord-ipc-${index}`);
  }

  const candidates = [];
  if (platform === "darwin") {
    for (const channel of ["discord", "discordcanary", "discordptb"]) {
      candidates.push(path.join(home, "Library", "Application Support", channel, "discord-ipc-0"));
    }
  } else {
    const runtime = env.XDG_RUNTIME_DIR || (env.USER ? `/run/user/${process.getuid?.() ?? ""}` : "");
    if (runtime) candidates.push(path.join(runtime, "discord-ipc-0"));
    for (const channel of ["discord", "discordcanary", "discordptb", "discorddevelopment"]) {
      candidates.push(path.join(home, ".config", channel, "discord-ipc-0"));
    }
    candidates.push("/tmp/discord-ipc-0");
  }
  return [...new Set(candidates)].filter((candidate) => fs.existsSync(candidate));
}

export class DiscordIpcClient {
  constructor({ clientId, logger = console, activityFactory = buildActivity } = {}) {
    if (!/^\d{17,20}$/.test(clientId ?? "")) {
      throw new Error("DISCORD_CLIENT_ID must be your Discord application's numeric Application ID.");
    }
    this.clientId = clientId;
    this.logger = logger;
    this.activityFactory = activityFactory;
    this.startedAt = Date.now();
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.connected = false;
    this.stopping = false;
    this.retryMs = RECONNECT_MIN_MS;
    this.retryTimer = null;
    this.candidateIndex = 0;
    this.candidates = [];
  }

  start() {
    this.stopping = false;
    this.connect();
  }

  connect() {
    if (this.stopping) return;
    this.candidates = getIpcCandidates();
    if (this.candidates.length === 0) {
      this.scheduleReconnect("No Discord desktop IPC socket found. Is the Discord desktop app running?");
      return;
    }
    const candidate = this.candidates[this.candidateIndex % this.candidates.length];
    this.candidateIndex += 1;
    const socket = net.createConnection(candidate);
    this.socket = socket;
    this.buffer = Buffer.alloc(0);

    socket.once("connect", () => {
      this.retryMs = RECONNECT_MIN_MS;
      socket.write(encode(OP.HANDSHAKE, { v: VERSION, client_id: this.clientId }));
      this.logger.info("[Avero RPC] Connected to Discord IPC; waiting for READY.");
    });
    socket.on("data", (chunk) => this.consume(chunk));
    socket.on("error", (error) => {
      this.logger.warn(`[Avero RPC] IPC connection error: ${error.message}`);
    });
    socket.once("close", () => {
      this.connected = false;
      if (this.socket === socket) this.socket = null;
      if (!this.stopping) this.scheduleReconnect("Discord IPC disconnected.");
    });
  }

  consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 8) {
      const opcode = this.buffer.readInt32LE(0);
      const length = this.buffer.readInt32LE(4);
      if (length < 0 || length > 16 * 1024 * 1024) {
        this.logger.error("[Avero RPC] Invalid IPC frame length; closing connection.");
        this.socket?.destroy();
        return;
      }
      if (this.buffer.length < 8 + length) return;
      const body = this.buffer.subarray(8, 8 + length).toString("utf8");
      this.buffer = this.buffer.subarray(8 + length);
      let payload;
      try {
        payload = body ? JSON.parse(body) : {};
      } catch {
        this.logger.warn("[Avero RPC] Ignored malformed IPC payload.");
        continue;
      }
      this.handlePacket(opcode, payload);
    }
  }

  handlePacket(opcode, payload) {
    if (opcode === OP.PING) {
      this.socket?.write(encode(OP.PONG, payload));
      return;
    }
    if (opcode === OP.CLOSE) {
      this.logger.warn("[Avero RPC] Discord closed the IPC session.");
      this.socket?.end();
      return;
    }
    if (opcode !== OP.FRAME) return;

    if (payload.evt === "READY") {
      this.connected = true;
      this.logger.info("[Avero RPC] Discord desktop client is ready; publishing Avero to your user profile.");
      this.publish();
    } else if (payload.evt === "ERROR" || payload.cmd === "SET_ACTIVITY" && payload.evt === "ERROR") {
      this.logger.error("[Avero RPC] Discord rejected the activity:", payload.data ?? payload);
    }
  }

  publish() {
    if (!this.connected || !this.socket || this.socket.destroyed) return;
    const activity = this.activityFactory(process.env, this.startedAt);
    this.socket.write(encode(OP.FRAME, {
      cmd: "SET_ACTIVITY",
      args: { pid: process.pid, activity },
      nonce: `avero-${Date.now()}`
    }));
  }

  scheduleReconnect(reason) {
    if (this.stopping || this.retryTimer) return;
    this.logger.info(`[Avero RPC] ${reason} Retrying in ${Math.round(this.retryMs / 1000)}s.`);
    const delay = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, RECONNECT_MAX_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
    this.retryTimer.unref?.();
  }

  stop() {
    this.stopping = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.connected && this.socket && !this.socket.destroyed) {
      this.socket.write(encode(OP.FRAME, {
        cmd: "SET_ACTIVITY",
        args: { pid: process.pid, activity: null },
        nonce: `avero-stop-${Date.now()}`
      }));
    }
    this.socket?.end();
    this.socket = null;
    this.connected = false;
  }
}
