const GLOBAL_SCOPE_ID = "__avero_global__";

function requireIdentifier(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(name + " must be a non-empty string.");
  }
  return value.trim();
}

function memberWhere(guildId, userId) {
  requireIdentifier(guildId, "guildId");
  return {
    guildId_userId: {
      guildId: GLOBAL_SCOPE_ID,
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

export async function equipProfileBadge(prisma, guildId, userId, itemId) {
  const key = memberWhere(guildId, userId).guildId_userId;
  if (typeof itemId !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(itemId)) {
    throw new TypeError("Badge item ID must be a simple lowercase identifier.");
  }
  const owned = await prisma.currencyPurchase.findUnique({
    where: { guildId_userId_itemId: { ...key, itemId } }
  });
  if (!owned) return { equipped: false, reason: "not_owned" };
  const profile = await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: { ...key, equippedBadgeItemId: itemId },
    update: { equippedBadgeItemId: itemId }
  });
  return { equipped: true, profile };
}

const PROFILE_FRAME_ITEM_IDS = new Set([
  "aurora_frame", "nebula_cape", "moonlit_token", "prism_crown", "pixel_cape",
  "cloud_specs", "comet_trail", "mossy_mug", "paper_crown"
]);

export async function equipProfileFrame(prisma, guildId, userId, itemId) {
  const key = memberWhere(guildId, userId).guildId_userId;
  if (!PROFILE_FRAME_ITEM_IDS.has(itemId)) throw new TypeError("That collectible cannot be used as a profile frame.");
  const owned = await prisma.currencyPurchase.findUnique({
    where: { guildId_userId_itemId: { ...key, itemId } }
  });
  if (!owned) return { equipped: false, reason: "not_owned" };
  const profile = await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: { ...key, equippedFrameItemId: itemId },
    update: { equippedFrameItemId: itemId }
  });
  return { equipped: true, profile };
}

export async function unequipProfileFrame(prisma, guildId, userId) {
  const key = memberWhere(guildId, userId).guildId_userId;
  const profile = await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: key,
    update: { equippedFrameItemId: null }
  });
  return { unequipped: true, profile };
}

export async function unequipProfileBadge(prisma, guildId, userId) {
  const key = memberWhere(guildId, userId).guildId_userId;
  const profile = await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: key,
    update: { equippedBadgeItemId: null }
  });
  return { unequipped: true, profile };
}

const PROFILE_ACCENT_COLORS = new Set([0x8b7cff, 0x42d6c5, 0x65a9ff, 0xff9b70, 0xf078a8, 0xe5c45d, 0x9ba5b4, 0xffffff]);
const PROFILE_BANNERS = new Set(["midnight", "aurora", "sunset", "forest", "ocean", "graphite"]);
const AVATAR_DECORATIONS = new Set(["halo_ring", "orbit_spark", "pixel_wings"]);
const SHOWCASE_BADGES = new Set(["neon_badge", "vault_badge", "starlight_badge", "avero_relic", "star_pin", "tiny_trophy", "crystal_badge", "golden_owl"]);

export async function updateProfileCustomization(prisma, guildId, userId, changes) {
  const key = memberWhere(guildId, userId).guildId_userId;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new TypeError("Profile customization changes must be an object.");
  }
  const data = {};
  if (Object.hasOwn(changes, "profileAccentColor")) {
    if (!PROFILE_ACCENT_COLORS.has(changes.profileAccentColor)) throw new RangeError("Choose an accent color from the Avero palette.");
    data.profileAccentColor = changes.profileAccentColor;
  }
  if (Object.hasOwn(changes, "profileBio")) {
    if (changes.profileBio !== null && (typeof changes.profileBio !== "string" || changes.profileBio.length > 120)) {
      throw new RangeError("Profile bio must be 120 characters or fewer.");
    }
    data.profileBio = changes.profileBio === null ? null : changes.profileBio.trim();
  }
  if (Object.hasOwn(changes, "profileBanner")) {
    if (!PROFILE_BANNERS.has(changes.profileBanner)) throw new RangeError("Choose a supported Avero banner.");
    data.profileBanner = changes.profileBanner;
  }
  if (Object.hasOwn(changes, "equippedAvatarDecorationId")) {
    const itemId = changes.equippedAvatarDecorationId;
    if (itemId !== null && !AVATAR_DECORATIONS.has(itemId)) throw new RangeError("That avatar decoration is not available.");
    if (itemId !== null) {
      const owned = await prisma.currencyPurchase.findUnique({ where: { guildId_userId_itemId: { ...key, itemId } } });
      if (!owned) return { updated: false, reason: "not_owned" };
    }
    data.equippedAvatarDecorationId = itemId;
  }
  if (Object.hasOwn(changes, "profileShowcaseBadgeIds")) {
    const ids = changes.profileShowcaseBadgeIds;
    if (!Array.isArray(ids) || ids.length > 5 || new Set(ids).size !== ids.length ||
        ids.some((id) => !SHOWCASE_BADGES.has(id))) {
      throw new RangeError("Choose up to five unique badges from your collection.");
    }
    for (const itemId of ids) {
      const owned = await prisma.currencyPurchase.findUnique({ where: { guildId_userId_itemId: { ...key, itemId } } });
      if (!owned) return { updated: false, reason: "not_owned" };
    }
    data.profileShowcaseBadgeIds = ids;
  }
  if (!Object.keys(data).length) throw new TypeError("No supported profile customization was provided.");
  const profile = await prisma.memberProfile.upsert({
    where: { guildId_userId: key },
    create: { ...key, ...data },
    update: data
  });
  return { updated: true, profile };
}
