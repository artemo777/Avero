import { PermissionFlagsBits } from "discord.js";

export const MESSAGE_MILESTONE_STEP = 5000;
export const MESSAGE_MILESTONE_MAX = 100000;
const PENDING_RETRY_LIMIT = 5;
const CLAIM_LEASE_MS = 2 * 60 * 1000;

export function isValidMessageMilestone(value) {
  return Number.isSafeInteger(value) && value >= MESSAGE_MILESTONE_STEP &&
    value <= MESSAGE_MILESTONE_MAX && value % MESSAGE_MILESTONE_STEP === 0;
}

export function renderMessageMilestoneTemplate(template, message, count, threshold) {
  const replacements = {
    user: message.author.toString(),
    mention: message.author.toString(),
    username: message.author.username ?? message.author.globalName ?? "member",
    user_id: message.author.id,
    server: message.guild?.name ?? "this server",
    server_id: message.guildId,
    channel: message.channel?.name ?? "this channel",
    count: Number(count).toLocaleString("en-US"),
    milestone: Number(threshold).toLocaleString("en-US")
  };
  const source = String(template ?? "").slice(0, 1800);
  const hasUserToken = /\{(?:user|mention)\}/.test(source);
  const rendered = source.replace(/\{(user|mention|username|user_id|server|server_id|channel|count|milestone)\}/g,
    (_, key) => replacements[key]);
  const content = (hasUserToken ? rendered : message.author.toString() + " " + rendered).slice(0, 2000);
  return content;
}

async function claimAward(prisma, award) {
  const staleBefore = new Date(Date.now() - CLAIM_LEASE_MS);
  const result = await prisma.memberMessageMilestoneAward.updateMany({
    where: {
      id: award.id,
      OR: [
        { status: "pending" },
        { status: "sending", claimedAt: { lt: staleBefore } }
      ]
    },
    data: { status: "sending", claimedAt: new Date(), attempts: { increment: 1 } }
  });
  return result.count === 1;
}

async function deliverAward(message, prisma, award) {
  if (!await claimAward(prisma, award)) return false;
  try {
    const channel = await message.guild.channels.fetch(award.channelId).catch(() => null);
    if (!channel || typeof channel.send !== "function") throw new Error("Milestone announcement channel is unavailable.");
    const me = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
    const permissions = me && typeof channel.permissionsFor === "function" ? channel.permissionsFor(me) : null;
    if (permissions && !permissions.has(PermissionFlagsBits.SendMessages)) {
      throw new Error("Avero is missing Send Messages permission in the milestone channel.");
    }
    const content = renderMessageMilestoneTemplate(
      award.responseContent, message, award.countAtAward, award.threshold
    );
    await channel.send({
      content,
      allowedMentions: { parse: [], users: [award.userId], roles: [], repliedUser: false }
    });
    await prisma.memberMessageMilestoneAward.update({
      where: { id: award.id },
      data: { status: "sent", sentAt: new Date(), claimedAt: null, lastError: null }
    });
    return true;
  } catch (error) {
    await prisma.memberMessageMilestoneAward.update({
      where: { id: award.id },
      data: {
        status: "pending",
        claimedAt: null,
        lastError: String(error?.message ?? "Unknown delivery error").slice(0, 500)
      }
    }).catch((updateError) => console.error("Message milestone retry state could not be saved:", updateError));
    console.error("Message milestone delivery failed for guild " + award.guildId + " member " + award.userId + " at " + award.threshold + ":", error?.message ?? error);
    return false;
  }
}

export async function handleMemberMessageMilestone(message, prisma) {
  if (!message?.guildId || !message.guild || !message.author || message.author.bot ||
      message.author.system || message.webhookId || message.system || !message.channelId) return null;

  const result = await prisma.$transaction(async (tx) => {
    const counter = await tx.memberMessageCounter.upsert({
      where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } },
      create: { guildId: message.guildId, userId: message.author.id, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true }
    });

    if (counter.count <= MESSAGE_MILESTONE_MAX && isValidMessageMilestone(counter.count)) {
      const config = await tx.autoResponseMilestone.findUnique({
        where: { guildId_threshold: { guildId: message.guildId, threshold: counter.count } }
      });
      if (config?.enabled) {
        await tx.memberMessageMilestoneAward.createMany({
          data: [{
            guildId: message.guildId,
            userId: message.author.id,
            threshold: counter.count,
            countAtAward: counter.count,
            channelId: message.channelId,
            responseContent: config.responseContent,
            status: "pending"
          }],
          skipDuplicates: true
        });
      }
    }

    const pending = await tx.memberMessageMilestoneAward.findMany({
      where: { guildId: message.guildId, userId: message.author.id, status: "pending" },
      orderBy: { createdAt: "asc" },
      take: PENDING_RETRY_LIMIT
    });
    return { count: counter.count, pending };
  });

  let delivered = 0;
  for (const award of result.pending) {
    if (await deliverAward(message, prisma, award)) delivered += 1;
  }
  return { count: result.count, delivered };
}
