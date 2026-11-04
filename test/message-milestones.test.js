import assert from "node:assert/strict";
import test from "node:test";
import {
  handleMemberMessageMilestone, isValidMessageMilestone, renderMessageMilestoneTemplate
} from "../src/bot/autoresponder/milestones.js";

function createMessage({ bot = false, webhookId = null } = {}) {
  const sent = [];
  const author = {
    id: "50000000000000001", username: "Ada", bot, system: false,
    toString: () => "<@50000000000000001>"
  };
  const channel = {
    name: "general",
    permissionsFor: () => ({ has: () => true }),
    send: async (payload) => { sent.push(payload); return {}; }
  };
  const message = {
    guildId: "30000000000000001", channelId: "40000000000000001", webhookId,
    system: false, author,
    guild: {
      name: "Avero Test", channels: { fetch: async () => channel },
      members: { me: {} }
    },
    channel
  };
  return { message, sent, channel };
}

function fakePrisma({ count, config = null, failFirstSend = false }) {
  let award = null;
  let sends = 0;
  const prisma = {
    $transaction: async (callback) => callback({
      memberMessageCounter: { upsert: async () => ({ count }) },
      autoResponseMilestone: { findUnique: async () => config },
      memberMessageMilestoneAward: {
        createMany: async ({ data }) => {
          if (!award) award = { id: "award-1", ...data[0], status: "pending", attempts: 0 };
          return { count: 1 };
        },
        findMany: async () => award?.status === "pending" ? [award] : []
      }
    }),
    memberMessageMilestoneAward: {
      updateMany: async ({ data }) => {
        if (!award || award.status === "sent" || award.status === "sending") return { count: 0 };
        Object.assign(award, data);
        return { count: 1 };
      },
      update: async ({ data }) => {
        Object.assign(award, data);
        return award;
      }
    }
  };
  return { prisma, getAward: () => award, getSends: () => sends, setSend: async (payload) => {
    sends += 1;
    if (failFirstSend && sends === 1) throw new Error("temporary Discord send failure");
    return payload;
  }};
}

test("accepts only 5,000-message increments through 100,000", () => {
  assert.equal(isValidMessageMilestone(5000), true);
  assert.equal(isValidMessageMilestone(100000), true);
  for (const value of [0, 1, 4999, 7500, 100001, 5000.5]) {
    assert.equal(isValidMessageMilestone(value), false);
  }
});

test("renders user, server, channel and milestone placeholders with a user mention", () => {
  const { message } = createMessage();
  assert.equal(
    renderMessageMilestoneTemplate("Congrats {username}! {count}/{milestone} in {server} #{channel}", message, 5000, 5000),
    "<@50000000000000001> Congrats Ada! 5,000/5,000 in Avero Test #general"
  );
  assert.equal(
    renderMessageMilestoneTemplate("Congrats {user}!", message, 5000, 5000),
    "Congrats <@50000000000000001>!"
  );
});

test("creates and delivers a milestone once at the configured count", async () => {
  const { message, sent } = createMessage();
  const state = fakePrisma({ count: 5000, config: {
    enabled: true, responseContent: "Amazing {username}, you reached {milestone} messages!"
  }});
  const result = await handleMemberMessageMilestone(message, state.prisma);
  assert.deepEqual(result, { count: 5000, delivered: 1 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content, "<@50000000000000001> Amazing Ada, you reached 5,000 messages!");
  assert.deepEqual(sent[0].allowedMentions, {
    parse: [], users: ["50000000000000001"], roles: [], repliedUser: false
  });
  assert.equal(state.getAward().status, "sent");
});

test("does not create an award between thresholds or for disabled milestones", async () => {
  const { message, sent } = createMessage();
  const between = fakePrisma({ count: 5001 });
  assert.deepEqual(await handleMemberMessageMilestone(message, between.prisma), { count: 5001, delivered: 0 });
  assert.equal(between.getAward(), null);
  const disabled = fakePrisma({ count: 10000, config: { enabled: false, responseContent: "disabled" } });
  assert.deepEqual(await handleMemberMessageMilestone(message, disabled.prisma), { count: 10000, delivered: 0 });
  assert.equal(disabled.getAward(), null);
  assert.equal(sent.length, 0);
});

test("ignores bots and webhook messages without incrementing counters", async () => {
  const bot = createMessage({ bot: true });
  let transactions = 0;
  const prisma = { $transaction: async () => { transactions += 1; } };
  assert.equal(await handleMemberMessageMilestone(bot.message, prisma), null);
  const webhook = createMessage({ webhookId: "90000000000000001" });
  assert.equal(await handleMemberMessageMilestone(webhook.message, prisma), null);
  assert.equal(transactions, 0);
});

test("keeps failed announcements pending and retries them on the member's next message", async () => {
  const { message, sent } = createMessage();
  const state = fakePrisma({ count: 5000, config: {
    enabled: true, responseContent: "You made it to {count}!"
  }, failFirstSend: true });
  const first = await handleMemberMessageMilestone(message, state.prisma);
  assert.deepEqual(first, { count: 5000, delivered: 0 });
  assert.equal(state.getAward().status, "pending");
  const second = await handleMemberMessageMilestone(message, state.prisma);
  assert.deepEqual(second, { count: 5000, delivered: 1 });
  assert.equal(state.getAward().status, "sent");
  assert.equal(sent.length, 1);
});
