import assert from "node:assert/strict";
import test from "node:test";
import { forgetAiMemory, listAiMemories, saveAiMemory } from "../src/db/ai-memory-repository.js";

function fakePrisma() {
  const rows = [];
  let nextId = 0;
  return {
    rows,
    aiMemory: {
      findUnique: async ({ where }) => rows.find((row) =>
        row.userId === where.userId_content.userId && row.content === where.userId_content.content) ?? null,
      findMany: async ({ where, take }) => rows.filter((row) => row.userId === where.userId)
        .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, take),
      count: async ({ where }) => rows.filter((row) => row.userId === where.userId).length,
      upsert: async ({ where, create, update }) => {
        let row = rows.find((entry) => entry.userId === where.userId_content.userId &&
          entry.content === where.userId_content.content);
        if (row) Object.assign(row, update, { updatedAt: new Date() });
        else {
          row = { id: "memory-" + (++nextId), ...create, createdAt: new Date(), updatedAt: new Date() };
          rows.push(row);
        }
        return row;
      },
      deleteMany: async ({ where }) => {
        const before = rows.length;
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (rows[index].id === where.id && rows[index].userId === where.userId) rows.splice(index, 1);
        }
        return { count: before - rows.length };
      }
    }
  };
}

test("AI memories persist per Discord user and duplicate saves update the same record", async () => {
  const prisma = fakePrisma();
  const first = await saveAiMemory(prisma, "user-a", "Prefers Swedish", "language");
  const duplicate = await saveAiMemory(prisma, "user-a", "Prefers Swedish", "preference");
  await saveAiMemory(prisma, "user-b", "Prefers English", "language");
  assert.equal(first.id, duplicate.id);
  assert.equal(prisma.rows.length, 2);
  assert.equal((await listAiMemories(prisma, "user-a")).length, 1);
  assert.equal((await listAiMemories(prisma, "user-b")).length, 1);
  assert.equal((await listAiMemories(prisma, "user-a"))[0].category, "preference");
});

test("a user cannot list or delete another user's memories", async () => {
  const prisma = fakePrisma();
  const saved = await saveAiMemory(prisma, "user-a", "Likes concise answers");
  assert.equal((await listAiMemories(prisma, "user-b")).length, 0);
  assert.equal(await forgetAiMemory(prisma, "user-b", saved.id), false);
  assert.equal(await forgetAiMemory(prisma, "user-a", saved.id), true);
  assert.equal((await listAiMemories(prisma, "user-a")).length, 0);
});

test("memory content is bounded and each user has a finite memory limit", async () => {
  const prisma = fakePrisma();
  await assert.rejects(saveAiMemory(prisma, "user-a", "x".repeat(501)), /500 characters/);
  for (let index = 0; index < 50; index += 1) await saveAiMemory(prisma, "user-a", "fact-" + index);
  await assert.rejects(saveAiMemory(prisma, "user-a", "one more fact"), /Memory limit reached/);
  assert.equal((await listAiMemories(prisma, "user-a")).length, 50);
});
