import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const SERVER_ID = process.env.ENGAUGE_SERVER_ID ?? "1434292419788017766";
const TOKEN = process.env.ENGAUGE_API_TOKEN;
const PAGE_SIZE = 50;
const APPLY = process.argv.includes("--apply");

function parseXp(value, field) {
  const xp = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(xp) || xp < 0) {
    throw new Error(`Engauge returned invalid ${field}.`);
  }
  return xp;
}

function levelForExperience(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}

async function getMembers() {
  if (!TOKEN) {
    throw new Error("Missing ENGAUGE_API_TOKEN environment secret.");
  }

  const members = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const url = new URL(`https://engau.ge/api/v1/servers/${SERVER_ID}/members`);
    url.searchParams.set("start", String(start));
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("order", "xp");
    url.searchParams.set("direction", "desc");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(20_000)
    });

    if (!response.ok) {
      // Do not print response bodies or headers; they may contain sensitive information.
      throw new Error(`Engauge API request failed with HTTP ${response.status}.`);
    }

    const payload = await response.json();
    const page = Array.isArray(payload) ? payload : payload.members ?? payload.data;
    if (!Array.isArray(page)) {
      throw new Error("Unexpected Engauge members response format; no data was imported.");
    }

    for (const member of page) {
      const userId = String(member.id ?? "");
      if (!/^\d{17,20}$/.test(userId)) {
        throw new Error("Engauge returned a member with an invalid Discord ID.");
      }
      members.push({
        userId,
        xp: parseXp(member.xp, "XP")
      });
    }

    if (page.length < PAGE_SIZE) break;
  }

  const unique = new Set(members.map((member) => member.userId));
  if (unique.size !== members.length) {
    throw new Error("Engauge returned duplicate member IDs; refusing to continue.");
  }
  return members;
}

const prisma = new PrismaClient();

try {
  if (!/^\d{17,20}$/.test(SERVER_ID)) {
    throw new Error("ENGAUGE_SERVER_ID must be a Discord server ID.");
  }

  const imported = await getMembers();
  const current = await prisma.memberProfile.findMany({
    where: { guildId: SERVER_ID },
    select: { userId: true, xp: true }
  });
  const currentById = new Map(current.map((profile) => [profile.userId, profile.xp]));

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let importedXpTotal = 0;

  const plan = imported.map(({ userId, xp }) => {
    const existingXp = currentById.get(userId);
    const finalXp = Math.max(xp, existingXp ?? 0);
    importedXpTotal += xp;
    if (existingXp === undefined) added += 1;
    else if (finalXp > existingXp) updated += 1;
    else unchanged += 1;
    return { userId, xp: finalXp, level: levelForExperience(finalXp) };
  });

  console.log(`Engauge server: ${SERVER_ID}`);
  console.log(`Members returned: ${imported.length}`);
  console.log(`XP total in Engauge records: ${importedXpTotal}`);
  console.log(`New profiles: ${added}; XP increases: ${updated}; unchanged/preserved: ${unchanged}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN (no database writes)"}`);

  if (!APPLY) {
    console.log("Review these counts, then run npm run migrate:engauge -- --apply to write the import.");
  } else {
    for (const profile of plan) {
      await prisma.memberProfile.upsert({
        where: {
          guildId_userId: {
            guildId: SERVER_ID,
            userId: profile.userId
          }
        },
        create: {
          guildId: SERVER_ID,
          userId: profile.userId,
          xp: profile.xp,
          level: profile.level
        },
        update: {
          xp: profile.xp,
          level: profile.level
        }
      });
    }
    console.log(`Imported ${plan.length} profiles. Existing higher XP was preserved; no level-up announcements or rewards were triggered.`);
  }
} catch (error) {
  console.error(`Engauge migration stopped: ${error.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
