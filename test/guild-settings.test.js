import test from "node:test";
import assert from "node:assert/strict";
import { getGuildSettings, updateGuildSettings } from "../src/db/guild-settings-repository.js";
import { getDailyRewardForMember, getRolePerk } from "../src/bot/role-perks.js";

function fakePrisma() {
  let record = null;
  return {
    guildSettings: {
      async upsert({ create }) {
        if (!record) record = { ...create };
        return { ...record };
      },
      async update({ data }) {
        record = { ...record, ...data };
        return { ...record };
      }
    }
  };
}

test("guild settings are created with safe defaults and remain server-scoped", async () => {
  const prisma = fakePrisma();
  const settings = await getGuildSettings(prisma, "12345678901234567");
  assert.equal(settings.gamesEnabled, true);
  assert.equal(settings.currencyEnabled, true);
  assert.equal(settings.dailyReward, 100);
  assert.equal(settings.workMinReward, 60);
  assert.equal(settings.workMaxReward, 120);
  await assert.rejects(getGuildSettings(prisma, "not-a-guild"), /valid Discord server ID/);
});

test("guild settings validate updates and keep work reward bounds ordered", async () => {
  const prisma = fakePrisma();
  await getGuildSettings(prisma, "12345678901234567");
  const saved = await updateGuildSettings(prisma, "12345678901234567", {
    gamesEnabled: false, dailyReward: 125, workMinReward: 70, workMaxReward: 140
  });
  assert.equal(saved.gamesEnabled, false);
  assert.equal(saved.dailyReward, 125);
  await assert.rejects(
    updateGuildSettings(prisma, "12345678901234567", { workMinReward: 200 }),
    /cannot exceed/
  );
  await assert.rejects(
    updateGuildSettings(prisma, "12345678901234567", { unknownSetting: true }),
    /Unsupported guild setting/
  );
  await assert.rejects(
    updateGuildSettings(prisma, "12345678901234567", { dailyReward: 0 }),
    /between 1 and 100000/
  );
});

test("Funder, Booster and Voter perks use one highest-priority role", () => {
  const settings = { funderRoleId: "funder", boosterRoleId: "booster", voterRoleId: "voter" };
  const member = { roles: ["booster", "voter", "funder"] };
  assert.deepEqual(getRolePerk(settings, member), {
    id: "funder", label: "Funder", dailyBonus: 15, flair: "✦ Funder"
  });
  assert.equal(getRolePerk(settings, { roles: ["booster", "voter"] }).dailyBonus, 10);
  assert.equal(getRolePerk(settings, { roles: ["voter"] }).id, "voter");
  assert.equal(getRolePerk(settings, { roles: [] }).dailyBonus, 0);
});

test("daily role bonus is added once and does not stack", () => {
  const result = getDailyRewardForMember(100, {
    funderRoleId: "funder", boosterRoleId: "booster"
  }, { roles: ["funder", "booster"] });
  assert.equal(result.amount, 115);
  assert.equal(result.perk.id, "funder");
  assert.throws(() => getDailyRewardForMember(0, {}, { roles: [] }), /positive safe integer/);
});