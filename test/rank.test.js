import test from "node:test";
import assert from "node:assert/strict";
import { rankCommand } from "../src/bot/commands/rank.js";

function makeInteraction({ guildId = "guild-1", target, profile } = {}) {
  let response;
  const interaction = {
    guildId,
    user: { id: "user-1", username: "ExampleUser" },
    options: {
      getUser: (name) => {
        assert.equal(name, "member");
        return target ?? null;
      }
    },
    reply: async (payload) => { response = payload; }
  };
  const prisma = {
    memberProfile: {
      findUnique: async ({ where }) => {
        assert.deepEqual(where, {
          guildId_userId: {
            guildId: guildId ?? "guild-1",
            userId: (target ?? interaction.user).id
          }
        });
        return profile ?? null;
      }
    }
  };
  return { interaction, prisma, getResponse: () => response };
}

test("rank command shows level, total XP, and progress to the next level", async () => {
  const { interaction, prisma, getResponse } = makeInteraction({
    profile: { xp: 250, level: 1 }
  });

  await rankCommand.execute(interaction, { prisma });

  const embed = getResponse().embeds[0];
  assert.equal(embed.title, "✦ ExampleUser's rank");
  assert.match(embed.description, /\*\*Level:\*\* 1/);
  assert.match(embed.description, /\*\*Total XP:\*\* 250/);
  assert.match(embed.description, /\*\*Progress:\*\* 150 \/ 300 XP to level 2/);
});

test("rank command shows zero XP for a member without a saved profile", async () => {
  const { interaction, prisma, getResponse } = makeInteraction();

  await rankCommand.execute(interaction, { prisma });

  const embed = getResponse().embeds[0];
  assert.match(embed.description, /\*\*Level:\*\* 0/);
  assert.match(embed.description, /\*\*Total XP:\*\* 0/);
  assert.match(embed.description, /\*\*Progress:\*\* 0 \/ 100 XP to level 1/);
});

test("rank command rejects direct messages with an ephemeral reply", async () => {
  const { interaction, prisma, getResponse } = makeInteraction({ guildId: null });

  await rankCommand.execute(interaction, { prisma });

  assert.deepEqual(getResponse(), {
    content: "The rank command can only be used in a server.",
    ephemeral: true
  });
});
