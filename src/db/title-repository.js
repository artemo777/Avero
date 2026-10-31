function requireIdentifier(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(name + " must be a non-empty string.");
  }
  return value.trim();
}

function titleKey(guildId, userId, titleId) {
  return {
    guildId: requireIdentifier(guildId, "guildId"),
    userId: requireIdentifier(userId, "userId"),
    titleId: requireIdentifier(titleId, "titleId")
  };
}

export async function getMemberTitles(prisma, guildId, userId) {
  return prisma.memberTitle.findMany({
    where: {
      guildId: requireIdentifier(guildId, "guildId"),
      userId: requireIdentifier(userId, "userId")
    },
    orderBy: { acquiredAt: "asc" }
  });
}

export async function unlockMemberTitle(prisma, guildId, userId, titleId, source = "milestone") {
  const key = titleKey(guildId, userId, titleId);
  const existing = await prisma.memberTitle.findUnique({
    where: { guildId_userId_titleId: key }
  });
  if (existing) return { unlocked: false, title: existing };
  try {
    const title = await prisma.memberTitle.create({
      data: { ...key, source }
    });
    return { unlocked: true, title };
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const title = await prisma.memberTitle.findUnique({
      where: { guildId_userId_titleId: key }
    });
    if (!title) throw error;
    return { unlocked: false, title };
  }
}

export async function equipMemberTitle(prisma, guildId, userId, titleId) {
  const key = {
    guildId: requireIdentifier(guildId, "guildId"),
    userId: requireIdentifier(userId, "userId")
  };
  if (titleId !== null) {
    const owned = await prisma.memberTitle.findUnique({
      where: { guildId_userId_titleId: { ...key, titleId: requireIdentifier(titleId, "titleId") } }
    });
    if (!owned) return { equipped: false, reason: "not_unlocked" };
  }
  const profile = await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: { ...key, equippedTitleId: titleId },
    update: { equippedTitleId: titleId }
  });
  return { equipped: true, profile };
}

export async function purchaseMemberTitle(prisma, guildId, userId, titleId, price, { now = new Date() } = {}) {
  const key = titleKey(guildId, userId, titleId);
  if (!Number.isSafeInteger(price) || price < 1 || price > 1_000_000) {
    throw new TypeError("Title price must be a positive integer no greater than 1000000.");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.currencyAccount.upsert({
        where: { guildId_userId: { guildId: key.guildId, userId: key.userId } },
        create: { guildId: key.guildId, userId: key.userId },
        update: {}
      });
      const existing = await tx.memberTitle.findUnique({
        where: { guildId_userId_titleId: key }
      });
      const accountBefore = await tx.currencyAccount.findUnique({
        where: { guildId_userId: { guildId: key.guildId, userId: key.userId } }
      });
      if (existing) return { purchased: false, reason: "owned", account: accountBefore };
      if (accountBefore.balance < price) return { purchased: false, reason: "insufficient_funds", account: accountBefore };
      const updated = await tx.currencyAccount.updateMany({
        where: { guildId: key.guildId, userId: key.userId, balance: { gte: price } },
        data: { balance: { decrement: price } }
      });
      if (updated.count !== 1) {
        const account = await tx.currencyAccount.findUnique({
          where: { guildId_userId: { guildId: key.guildId, userId: key.userId } }
        });
        return { purchased: false, reason: "insufficient_funds", account };
      }
      const title = await tx.memberTitle.create({
        data: { ...key, source: "shop", acquiredAt: now }
      });
      await tx.currencyTransaction.create({
        data: { guildId: key.guildId, userId: key.userId, amount: -price, type: "title_purchase", createdAt: now }
      });
      const account = await tx.currencyAccount.findUnique({
        where: { guildId_userId: { guildId: key.guildId, userId: key.userId } }
      });
      return { purchased: true, title, account };
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const [title, account] = await Promise.all([
      prisma.memberTitle.findUnique({ where: { guildId_userId_titleId: key } }),
      prisma.currencyAccount.findUnique({ where: { guildId_userId: { guildId: key.guildId, userId: key.userId } } })
    ]);
    if (!title) throw error;
    return { purchased: false, reason: "owned", account };
  }
}
