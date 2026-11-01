import test from "node:test";
import assert from "node:assert/strict";
import { WORK_JOBS, WORK_PROMOTION_THRESHOLDS } from "../src/bot/work-catalog.js";
import { applyForJob, getMemberJob, resignFromJob, runJobShift } from "../src/db/work-repository.js";

function fakePrisma() {
  let job = null;
  let account = null;
  const ledger = [];
  const prisma = {
    ledger,
    memberJob: {
      async findUnique() { return job ? { ...job } : null; },
      async create({ data }) {
        job = { ...data, id: "job-1", shifts: 0, promotions: 0, lastShiftAt: null };
        return { ...job };
      },
      async update({ data }) { job = { ...job, ...data }; return { ...job }; },
      async updateMany({ where, data }) {
        if (!job) return { count: 0 };
        if (where.jobId && job.jobId !== where.jobId) return { count: 0 };
        const allowed = where.OR
          ? where.OR.some((condition) => condition.lastShiftAt === null
            ? job.lastShiftAt === null
            : job.lastShiftAt instanceof Date && job.lastShiftAt <= condition.lastShiftAt.lte)
          : true;
        if (!allowed) return { count: 0 };
        if (data.jobId !== undefined) job.jobId = data.jobId;
        if (data.shifts?.increment) job.shifts += data.shifts.increment;
        if (data.promotions !== undefined) job.promotions = data.promotions;
        if (data.lastShiftAt) job.lastShiftAt = data.lastShiftAt;
        return { count: 1 };
      }
    },
    currencyAccount: {
      async upsert() { if (!account) account = { balance: 0 }; return account; },
      async updateMany({ data }) { account.balance += data.balance.increment; return { count: 1 }; },
      async findUnique() { return account ? { ...account } : null; }
    },
    currencyTransaction: { async create({ data }) { ledger.push(data); return data; } },
    async $transaction(callback) { return callback(prisma); }
  };
  return prisma;
}

test("Avero work catalog contains 20 distinct realistic careers", () => {
  assert.equal(WORK_JOBS.length, 20);
  assert.equal(new Set(WORK_JOBS.map((job) => job.id)).size, 20);
  assert.ok(WORK_JOBS.every((job) => job.salary >= 70 && job.salary <= 150));
});

test("members can apply for one job and cannot silently overwrite it", async () => {
  const prisma = fakePrisma();
  const applied = await applyForJob(prisma, "guild", "member", "barista");
  const duplicate = await applyForJob(prisma, "guild", "member", "barista");
  const change = await applyForJob(prisma, "guild", "member", "developer");
  assert.equal(applied.applied, true);
  assert.equal(duplicate.reason, "already_in_job");
  assert.equal(change.reason, "employed");
  assert.equal((await getMemberJob(prisma, "guild", "member")).jobId, "barista");
});

test("job shifts pay salary, enforce cooldown, and grant three promotions", async () => {
  const prisma = fakePrisma();
  const start = new Date("2026-11-01T12:00:00.000Z");
  await applyForJob(prisma, "guild", "member", "barista");
  const first = await runJobShift(prisma, "guild", "member", { now: start });
  assert.equal(first.worked, true);
  assert.equal(first.salary, 70);
  const tooSoon = await runJobShift(prisma, "guild", "member", { now: new Date(start.getTime() + 1000) });
  assert.equal(tooSoon.reason, "cooldown");

  for (let shift = 2; shift <= 50; shift++) {
    const now = new Date(start.getTime() + (shift - 1) * 60 * 60 * 1000);
    await runJobShift(prisma, "guild", "member", { now });
  }
  const final = await getMemberJob(prisma, "guild", "member");
  assert.equal(final.shifts, 50);
  assert.equal(final.promotions, 3);
  assert.equal(WORK_PROMOTION_THRESHOLDS.length, 3);
  assert.equal(prisma.ledger.length, 50);
  assert.ok(prisma.ledger.every((entry) => entry.currency === "coins"));
});

test("resigning removes the active career and allows a new application", async () => {
  const prisma = fakePrisma();
  await applyForJob(prisma, "guild", "member", "barista");
  const firstShiftAt = new Date("2026-11-01T12:00:00.000Z");
  await runJobShift(prisma, "guild", "member", { now: firstShiftAt });
  assert.equal((await resignFromJob(prisma, "guild", "member")).resigned, true);
  assert.equal(await getMemberJob(prisma, "guild", "member"), null);
  const reapplied = await applyForJob(prisma, "guild", "member", "developer");
  assert.equal(reapplied.applied, true);
  const blocked = await runJobShift(prisma, "guild", "member", { now: new Date(firstShiftAt.getTime() + 1000) });
  assert.equal(blocked.reason, "cooldown");
  const afterCooldown = await runJobShift(prisma, "guild", "member", { now: new Date(firstShiftAt.getTime() + 60 * 60 * 1000) });
  assert.equal(afterCooldown.worked, true);
  assert.equal(afterCooldown.salary, 140);
});
