const MAX_MEMORIES_PER_USER = 50;

function validUserId(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 32) {
    throw new TypeError("A valid Discord user ID is required.");
  }
  return value;
}

export async function listAiMemories(prisma, userId) {
  const key = validUserId(userId);
  return prisma.aiMemory.findMany({
    where: { userId: key },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: MAX_MEMORIES_PER_USER
  });
}

export async function saveAiMemory(prisma, userId, content, category = "general") {
  const key = validUserId(userId);
  const value = typeof content === "string" ? content.trim() : "";
  if (!value || value.length > 500) throw new RangeError("Memory must contain 1 to 500 characters.");
  const label = typeof category === "string" && category.trim() ? category.trim().slice(0, 40) : "general";
  const existing = await prisma.aiMemory.findUnique({
    where: { userId_content: { userId: key, content: value } }
  });
  if (!existing) {
    const count = await prisma.aiMemory.count({ where: { userId: key } });
    if (count >= MAX_MEMORIES_PER_USER) throw new Error("Memory limit reached.");
  }
  return prisma.aiMemory.upsert({
    where: { userId_content: { userId: key, content: value } },
    create: { userId: key, content: value, category: label },
    update: { category: label }
  });
}

export async function forgetAiMemory(prisma, userId, memoryId) {
  const key = validUserId(userId);
  if (typeof memoryId !== "string" || !memoryId.trim()) return false;
  const result = await prisma.aiMemory.deleteMany({
    where: { id: memoryId.trim(), userId: key }
  });
  return result.count > 0;
}
