function requireIdentifier(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(name + " must be a non-empty string.");
  }
  return value.trim();
}

function memberWhere(guildId, userId) {
  return {
    guildId_userId: {
      guildId: requireIdentifier(guildId, "guildId"),
      userId: requireIdentifier(userId, "userId")
    }
  };
}

export async function getMemberProfile(prisma, guildId, userId) {
  return prisma.memberProfile.findUnique({
    where: memberWhere(guildId, userId)
  });
}

export async function ensureMemberProfile(prisma, guildId, userId) {
  const key = memberWhere(guildId, userId).guildId_userId;
  return prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: key,
    update: {}
  });
}

export async function addExperience(prisma, guildId, userId, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new TypeError("Experience amount must be a positive safe integer.");
  }

  const key = memberWhere(guildId, userId).guildId_userId;
  return prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: { ...key, xp: amount },
    update: { xp: { increment: amount } }
  });
}
