import { WORK_JOBS, WORK_PROMOTION_THRESHOLDS, WORK_SHIFT_COOLDOWN_MS } from "../bot/work-catalog.js";

const GLOBAL_SCOPE_ID = "__avero_global__";

function key(guildId, userId) {
  if (typeof guildId !== "string" || !guildId.trim() || typeof userId !== "string" || !userId.trim()) {
    throw new TypeError("A guild and member are required.");
  }
  return { guildId: GLOBAL_SCOPE_ID, userId: userId.trim() };
}

export async function getMemberJob(prisma, guildId, userId) {
  const current = await prisma.memberJob.findUnique({ where: { guildId_userId: key(guildId, userId) } });
  return current?.jobId === "unemployed" ? null : current;
}

export async function applyForJob(prisma, guildId, userId, jobId) {
  const memberKey = key(guildId, userId);
  const job = WORK_JOBS.find((entry) => entry.id === jobId);
  if (!job) throw new RangeError("Choose a job from the Avero work list.");
  const existing = await prisma.memberJob.findUnique({ where: { guildId_userId: memberKey } });
  if (existing?.jobId === "unemployed") {
    const updated = await prisma.memberJob.updateMany({
      where: { ...memberKey, jobId: "unemployed" },
      data: { jobId, shifts: 0, promotions: 0 }
    });
    if (updated.count === 1) {
      return { applied: true, current: await prisma.memberJob.findUnique({ where: { guildId_userId: memberKey } }), job };
    }
    const latest = await prisma.memberJob.findUnique({ where: { guildId_userId: memberKey } });
    return { applied: false, reason: latest?.jobId === jobId ? "already_in_job" : "employed", current: latest, job };
  }
  if (existing) return { applied: false, reason: existing.jobId === jobId ? "already_in_job" : "employed", current: existing, job };
  const current = await prisma.memberJob.create({ data: { ...memberKey, jobId } });
  return { applied: true, current, job };
}

export async function resignFromJob(prisma, guildId, userId) {
  const memberKey = key(guildId, userId);
  const current = await prisma.memberJob.findUnique({ where: { guildId_userId: memberKey } });
  if (!current || current.jobId === "unemployed") return { resigned: false, reason: "not_employed" };
  await prisma.memberJob.update({
    where: { guildId_userId: memberKey },
    data: { jobId: "unemployed", shifts: 0, promotions: 0 }
  });
  return { resigned: true, current };
}

export async function runJobShift(prisma, guildId, userId, { now = new Date(), cooldownMs = WORK_SHIFT_COOLDOWN_MS, bonusCoins = 0 } = {}) {
  const memberKey = key(guildId, userId);
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError("now must be a valid Date.");
  if (!Number.isSafeInteger(bonusCoins) || bonusCoins < 0 || bonusCoins > 100) throw new TypeError("Work bonus must be an integer from 0 to 100.");
  const current = await prisma.memberJob.findUnique({ where: { guildId_userId: memberKey } });
  if (!current || current.jobId === "unemployed") return { worked: false, reason: "not_employed" };
  const job = WORK_JOBS.find((entry) => entry.id === current.jobId);
  if (!job) throw new Error("The saved Avero job is not in the current job list.");
  const nextAt = current.lastShiftAt ? new Date(current.lastShiftAt.getTime() + cooldownMs) : null;
  if (nextAt && nextAt > now) return { worked: false, reason: "cooldown", nextAt, current, job, cooldownMs };

  return prisma.$transaction(async (tx) => {
    await tx.currencyAccount.upsert({ where: { guildId_userId: memberKey }, create: memberKey, update: {} });
    const nextShifts = current.shifts + 1;
    const nextPromotions = Math.min(3, WORK_PROMOTION_THRESHOLDS.filter((threshold) => nextShifts >= threshold).length);
    const salary = Math.round(job.salary * (1 + current.promotions * 0.15)) + bonusCoins;
    const updatedJob = await tx.memberJob.updateMany({
      where: {
        ...memberKey,
        OR: [
          { lastShiftAt: null },
          { lastShiftAt: { lte: new Date(now.getTime() - cooldownMs) } }
        ]
      },
      data: { shifts: { increment: 1 }, promotions: nextPromotions, lastShiftAt: now }
    });
    if (updatedJob.count !== 1) {
      const latest = await tx.memberJob.findUnique({ where: { guildId_userId: memberKey } });
      return { worked: false, reason: "cooldown", nextAt: latest?.lastShiftAt ? new Date(latest.lastShiftAt.getTime() + cooldownMs) : null, current: latest, job, cooldownMs };
    }
    await tx.currencyAccount.updateMany({ where: memberKey, data: { balance: { increment: salary } } });
    await tx.currencyTransaction.create({ data: { ...memberKey, amount: salary, currency: "coins", type: "work_shift", createdAt: now } });
    const [account, updated] = await Promise.all([
      tx.currencyAccount.findUnique({ where: { guildId_userId: memberKey } }),
      tx.memberJob.findUnique({ where: { guildId_userId: memberKey } })
    ]);
    return {
      worked: true, salary, account, current: updated, job, cooldownMs,
      promoted: nextPromotions > current.promotions,
      promotion: nextPromotions,
      nextPromotionAt: WORK_PROMOTION_THRESHOLDS[nextPromotions] ?? null
    };
  });
}
