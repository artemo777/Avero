import { WORK_JOBS, WORK_PROMOTION_THRESHOLDS, WORK_SHIFT_COOLDOWN_MS } from "../bot/work-catalog.js";

function key(guildId, userId) {
  if (typeof guildId !== "string" || !guildId.trim() || typeof userId !== "string" || !userId.trim()) {
    throw new TypeError("A guild and member are required.");
  }
  return { guildId: guildId.trim(), userId: userId.trim() };
}

export async function getMemberJob(prisma, guildId, userId) {
  return prisma.memberJob.findUnique({ where: { guildId_userId: key(guildId, userId) } });
}

export async function applyForJob(prisma, guildId, userId, jobId) {
  const memberKey = key(guildId, userId);
  const job = WORK_JOBS.find((entry) => entry.id === jobId);
  if (!job) throw new RangeError("Choose a job from the Avero work list.");
  const existing = await prisma.memberJob.findUnique({ where: { guildId_userId: memberKey } });
  if (existing) return { applied: false, reason: existing.jobId === jobId ? "already_in_job" : "employed", current: existing, job };
  const current = await prisma.memberJob.create({ data: { ...memberKey, jobId } });
  return { applied: true, current, job };
}

export async function resignFromJob(prisma, guildId, userId) {
  const memberKey = key(guildId, userId);
  const current = await prisma.memberJob.findUnique({ where: { guildId_userId: memberKey } });
  if (!current) return { resigned: false, reason: "not_employed" };
  await prisma.memberJob.delete({ where: { guildId_userId: memberKey } });
  return { resigned: true, current };
}

export async function runJobShift(prisma, guildId, userId, { now = new Date(), cooldownMs = WORK_SHIFT_COOLDOWN_MS } = {}) {
  const memberKey = key(guildId, userId);
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError("now must be a valid Date.");
  const current = await prisma.memberJob.findUnique({ where: { guildId_userId: memberKey } });
  if (!current) return { worked: false, reason: "not_employed" };
  const job = WORK_JOBS.find((entry) => entry.id === current.jobId);
  if (!job) throw new Error("The saved Avero job is not in the current job list.");
  const nextAt = current.lastShiftAt ? new Date(current.lastShiftAt.getTime() + cooldownMs) : null;
  if (nextAt && nextAt > now) return { worked: false, reason: "cooldown", nextAt, current, job };

  return prisma.$transaction(async (tx) => {
    await tx.currencyAccount.upsert({ where: { guildId_userId: memberKey }, create: memberKey, update: {} });
    const nextShifts = current.shifts + 1;
    const nextPromotions = Math.min(3, WORK_PROMOTION_THRESHOLDS.filter((threshold) => nextShifts >= threshold).length);
    const salary = Math.round(job.salary * (1 + current.promotions * 0.15));
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
      return { worked: false, reason: "cooldown", nextAt: latest?.lastShiftAt ? new Date(latest.lastShiftAt.getTime() + cooldownMs) : null, current: latest, job };
    }
    await tx.currencyAccount.updateMany({ where: memberKey, data: { balance: { increment: salary } } });
    await tx.currencyTransaction.create({ data: { ...memberKey, amount: salary, currency: "coins", type: "work_shift", createdAt: now } });
    const [account, updated] = await Promise.all([
      tx.currencyAccount.findUnique({ where: { guildId_userId: memberKey } }),
      tx.memberJob.findUnique({ where: { guildId_userId: memberKey } })
    ]);
    return {
      worked: true, salary, account, current: updated, job,
      promoted: nextPromotions > current.promotions,
      promotion: nextPromotions,
      nextPromotionAt: WORK_PROMOTION_THRESHOLDS[nextPromotions] ?? null
    };
  });
}
