import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Replace or append only the requested KEY=value assignments while preserving
 * unrelated .env entries and comments. Values are plain Discord snowflake IDs.
 */
export function mergeEnvAssignments(source, assignments) {
  const lines = String(source ?? "").split(/\r?\n/);
  const requested = new Map(Object.entries(assignments));
  for (const [key, value] of requested) {
    if (!/^AVERO_EMOJI_[A-Z0-9_]+_ID$/.test(key)) {
      throw new TypeError("Only AVERO_EMOJI_*_ID assignments can be written.");
    }
    if (typeof value !== "string" || !/^\d{17,20}$/.test(value)) {
      throw new TypeError("Emoji IDs must be valid Discord snowflake IDs.");
    }
  }
  const found = new Set();
  const output = lines.map((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match || !requested.has(match[1])) return line;
    const key = match[1];
    if (found.has(key)) return null;
    found.add(key);
    return key + "=" + requested.get(key);
  }).filter((line) => line !== null);

  while (output.length && output.at(-1) === "") output.pop();
  const missing = [...requested].filter(([key]) => !found.has(key));
  if (missing.length) {
    if (output.length) output.push("");
    for (const [key, value] of missing) output.push(key + "=" + value);
  }
  return output.join("\n") + "\n";
}

/**
 * Persist emoji IDs to a private env file so the bot can use the custom emoji
 * on its next restart without manual copy/paste. Never writes the bot token.
 */
export async function writeEmojiEnvironment(assignments, envPath = process.env.AVERO_EMOJI_ENV_PATH || ".env") {
  const target = path.resolve(envPath);
  let current = "";
  try {
    current = await readFile(target, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  await writeFile(target, mergeEnvAssignments(current, assignments), { encoding: "utf8", mode: 0o600 });
  await chmod(target, 0o600);
  return target;
}
