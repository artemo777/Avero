const CACHE_TTL_MS = 3000;
const ruleCache = new Map();
function validGuildId(value) {
  if (typeof value !== "string" || !/^\d{17,20}$/.test(value)) throw new TypeError("Invalid Discord server ID.");
  return value;
}
function invalidate(guildId) { ruleCache.delete(guildId); }
export async function listAutoResponseRules(prisma, guildId, { force = false } = {}) {
  const key = validGuildId(guildId);
  const cached = ruleCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value;
  const rules = await prisma.autoResponseRule.findMany({ where: { guildId: key }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }] });
  ruleCache.set(key, { value: rules, expiresAt: Date.now() + CACHE_TTL_MS });
  return rules;
}
export async function createAutoResponseRule(prisma, guildId, data) {
  const key = validGuildId(guildId);
  const rule = await prisma.autoResponseRule.create({ data: { ...data, guildId: key } });
  invalidate(key); return rule;
}
export async function updateAutoResponseRule(prisma, guildId, ruleId, data) {
  const key = validGuildId(guildId);
  const result = await prisma.autoResponseRule.updateMany({ where: { id: ruleId, guildId: key }, data });
  invalidate(key); return result.count;
}
export async function deleteAutoResponseRule(prisma, guildId, ruleId) {
  const key = validGuildId(guildId);
  const result = await prisma.autoResponseRule.deleteMany({ where: { id: ruleId, guildId: key } });
  if (result.count) await prisma.autoResponseCooldown.deleteMany({ where: { ruleId } });
  invalidate(key); return result.count;
}
export async function createAutoResponseLog(prisma, data) { return prisma.autoResponseLog.create({ data }); }
export async function getAutoResponseStats(prisma, guildId) {
  const key = validGuildId(guildId);
  const [total, recent] = await Promise.all([
    prisma.autoResponseLog.count({ where: { guildId: key, status: "sent" } }),
    prisma.autoResponseLog.count({ where: { guildId: key, status: "sent", createdAt: { gte: new Date(Date.now() - 86400000) } } })
  ]);
  return { total, recent };
}

export async function getAutoResponseLogs(prisma, guildId, take = 10) {
  const key = validGuildId(guildId);
  return prisma.autoResponseLog.findMany({
    where: { guildId: key },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(Number(take) || 10, 1), 25),
    select: { ruleId: true, userId: true, channelId: true, status: true, createdAt: true }
  });
}
