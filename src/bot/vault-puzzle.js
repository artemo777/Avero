import { createHash } from "node:crypto";

function digitClue(bytes, offset) {
  const left = bytes[offset] % 10;
  const right = bytes[offset + 1] % 10;
  const offsetValue = bytes[offset + 2] % 10;
  return {
    clue: "(" + left + " × " + right + " + " + offsetValue + ") mod 10",
    digit: (left * right + offsetValue) % 10
  };
}

export function createVaultChallenge(guildId, now = new Date()) {
  if (typeof guildId !== "string" || !guildId.trim()) {
    throw new TypeError("A server ID is required for the daily vault.");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }
  const date = now.toISOString().slice(0, 10);
  const bytes = createHash("sha256").update(guildId + ":" + date).digest();
  const digits = [0, 1, 2].map((index) => digitClue(bytes, index * 3));
  return Object.freeze({
    date,
    code: digits.map((entry) => entry.digit).join(""),
    clues: digits.map((entry, index) => "Dial " + (index + 1) + ": " + entry.clue)
  });
}
