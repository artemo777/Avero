import test from "node:test";
import assert from "node:assert/strict";
import { runJobShift } from "../src/db/work-repository.js";

test("a stale career snapshot cannot award a salary after a job-state change", async () => {
  const current = { guildId: "__avero_global__", userId: "user-1", jobId: "barista", shifts: 2, promotions: 0, lastShiftAt: null };
  let salaryWrites = 0;
  let ledgerWrites = 0;
  const tx = {
    currencyAccount: {
      async upsert() { return {}; },
      async updateMany() { salaryWrites++; return { count: 1 }; },
      async findUnique() { return { balance: 0 }; }
    },
    memberJob: {
      async updateMany(args) {
        assert.equal(args.where.jobId, current.jobId);
        assert.equal(args.where.shifts, current.shifts);
        assert.equal(args.where.promotions, current.promotions);
        assert.equal(args.where.lastShiftAt, current.lastShiftAt);
        // Simulate resignation or another state change winning the race.
        return { count: 0 };
      },
      async findUnique() { return { ...current, jobId: "unemployed" }; }
    },
    currencyTransaction: { async create() { ledgerWrites++; } }
  };
  const prisma = {
    memberJob: { async findUnique() { return current; } },
    async $transaction(callback) { return callback(tx); }
  };

  const result = await runJobShift(prisma, "guild-1", "user-1", { now: new Date("2026-11-20T12:00:00Z") });
  assert.equal(result.worked, false);
  assert.equal(salaryWrites, 0);
  assert.equal(ledgerWrites, 0);
});
