function hasRole(member, roleId) {
  if (!roleId || !member) return false;
  const roles = member.roles;
  if (Array.isArray(roles)) return roles.includes(roleId);
  if (roles?.cache?.has) return roles.cache.has(roleId);
  return false;
}
export function getRolePerk(settings, member) {
  if (hasRole(member, settings?.funderRoleId)) return { id: "funder", label: "Funder", dailyBonus: 15, flair: "✦ Funder" };
  if (hasRole(member, settings?.boosterRoleId)) return { id: "booster", label: "Server Booster", dailyBonus: 10, flair: "↗ Booster" };
  if (hasRole(member, settings?.voterRoleId)) return { id: "voter", label: "Voter", dailyBonus: 10, flair: "▣ Voter" };
  return { id: "member", label: "Member", dailyBonus: 0, flair: null };
}
export function getDailyRewardForMember(baseReward, settings, member) {
  if (!Number.isSafeInteger(baseReward) || baseReward < 1) throw new TypeError("Base daily reward must be a positive safe integer.");
  const perk = getRolePerk(settings, member);
  return { amount: baseReward + perk.dailyBonus, perk };
}