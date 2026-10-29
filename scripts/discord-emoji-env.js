import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Replace or append only the requested KEY=value assignments while preserving
 * unrelated .env entries and comments. Values are plain Discord snowflake IDs.
 */
export function mergeEnvAssignments(source, assignments) {
  const lines = String(source ?? "").split(/\r?\n/);
  const pending = new Map(Object.entries(assignments));
  const output = lines.map((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match || !pending.has(match[1])) return line;
    const key = match[1];
    const value = pending.get(key);
    pending.delete(key);
    return key + "=" + value;
  });

  while (output.length && output.at(-1) === "") output.pop();
  if (pending.size) {
    if (output.length) output.push("");
    for (const [key, value] of pending) output.push(key + "=" + value);
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
