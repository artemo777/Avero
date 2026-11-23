const ANSI = { gray:"\x1b[90m", blue:"\x1b[36m", green:"\x1b[32m", yellow:"\x1b[33m", red:"\x1b[31m", reset:"\x1b[0m" };
const labels = { log:"INFO", info:"INFO", warn:"WARN", error:"ERR", debug:"DBG" };
let installed = false;
const original = {};
function stamp() { return new Date().toLocaleTimeString("en-GB", { hour12:false }); }
function safe(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "string") return value.replace(/(token|password|secret|authorization|api[_-]?key)(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[redacted]");
  try { return JSON.stringify(value); } catch { return String(value); }
}
function emit(level, args) {
  const label = labels[level] || "INFO";
  const color = level === "error" ? ANSI.red : level === "warn" ? ANSI.yellow : level === "debug" ? ANSI.gray : level === "info" ? ANSI.blue : ANSI.green;
  const msg = args.map(safe).join(" ");
  original.log(`${ANSI.gray}[${stamp()}]${ANSI.reset} ${color}${label.padEnd(4)}${ANSI.reset} ${msg}`);
}
export function installConsoleLogger() {
  if (installed) return;
  installed = true;
  for (const method of ["log","info","warn","error","debug"]) {
    original[method] = console[method].bind(console);
    console[method] = (...args) => emit(method, args);
  }
}
export const log = {
  system: (...args) => emit("log", ["SYS", ...args]),
  info: (...args) => emit("info", args),
  ok: (...args) => emit("log", ["OK", ...args]),
  warn: (...args) => emit("warn", args),
  error: (...args) => emit("error", args),
  debug: (...args) => emit("debug", args)
};
