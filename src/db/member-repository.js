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

export function levelForExperience(xp) {
  if (!Number.isSafeInteger(xp) || xp < 0) {
    throw new TypeError("Experience must be a non-negative safe integer.");
  }
  return Math.floor(Math.sqrt(xp / 100));
}

export function experienceForLevel(level) {
  if (!Number.isSafeInteger(level) || level < 0) {
    throw new TypeError("Level must be a non-negative safe integer.");
  }
  return 100 * level * level;
}

export async function recordMessageExperience(
  prisma,
  guildId,
  userId,
  { amount, cooldownMs = 60_000, now = new Date() } = {}
) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new TypeError("Experience amount must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 0) {
    throw new TypeError("Cooldown must be a non-negative safe integer.");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }

  const key = memberWhere(guildId, userId).guildId_userId;
  await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: key,
    update: {}
  });

  const previous = await prisma.memberProfile.findUnique({
    where: { guildId_userId: key }
  });
  const previousLevel = previous.level;
  const result = await prisma.memberProfile.updateMany({
    where: {
      ...key,
      OR: [
        { lastMessageXpAt: null },
        { lastMessageXpAt: { lte: new Date(now.getTime() - cooldownMs) } }
      ]
    },
    data: {
      xp: { increment: amount },
      lastMessageXpAt: now
    }
  });

  if (result.count === 0) {
    return { awarded: false, previousLevel, profile: previous };
  }

  const profile = await prisma.memberProfile.findUnique({
    where: { guildId_userId: key }
  });
  const level = levelForExperience(profile.xp);
  const updatedProfile = level === profile.level
    ? profile
    : await prisma.memberProfile.update({
        where: { guildId_userId: key },
        data: { level }
      });

  return {
    awarded: true,
    previousLevel,
    profile: updatedProfile
  };
}
