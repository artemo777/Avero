import test from "node:test";
import assert from "node:assert/strict";
import { recordGuessResult } from "../src/db/currency-repository.js";

test("records each guess win and loss without changing the coin balance", async () => {
  const records = [];
  const prisma = {
    currencyTransaction: {
      async create({ data }) {
        records.push(data);
        return data;
      }
    }
  };
  await recordGuessResult(prisma, "guild-1", "user-1", true, { now: new Date("2026-10-29T12:00:00.000Z") });
  await recordGuessResult(prisma, "guild-1", "user-1", false, { now: new Date("2026-10-29T12:01:00.000Z") });
  assert.deepEqual(records.map(({ type, amount }) => ({ type, amount })), [
    { type: "guess_win_play", amount: 0 },
    { type: "guess_loss", amount: 0 }
  ]);
  assert.ok(records.every((record) => record.guildId === "guild-1" && record.userId === "user-1"));
});

test("guess result recorder rejects non-boolean outcomes", async () => {
  await assert.rejects(recordGuessResult({}, "guild-1", "user-1", "win"), /won must be a boolean/);
});
