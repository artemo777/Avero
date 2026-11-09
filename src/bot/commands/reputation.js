import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle
} from "discord.js";
import {
  giveReputation, getReputationSummary, getReputationHistory, getReputationLeaderboard
} from "../../db/reputation-repository.js";

const DARK = 0x343840;
const fmt = (value) => Number(value ?? 0).toLocaleString("en-US");
const repId = (action, targetId = "") => ["avero-rep", action, targetId].filter(Boolean).join("|");

function profilePayload(target, summary, note = "") {
  const embed = new EmbedBuilder()
    .setColor(DARK)
    .setAuthor({ name: "AVERO • REPUTATION" })
    .setTitle((target.globalName ?? target.username) + "'s reputation")
    .setDescription([
      note,
      "**" + fmt(summary.net) + "** net reputation",
      "",
      "🟩 Positive received: **" + fmt(summary.positive) + "**",
      "🟥 Negative received: **" + fmt(summary.negative) + "**",
      "Total votes: **" + fmt(summary.total) + "**"
    ].filter(Boolean).join("\n"))
    .setThumbnail(target.displayAvatarURL({ size: 128 }))
    .setFooter({ text: "One reputation vote per member every 24 hours • Server-scoped" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(repId("give", target.id)).setLabel("+ Give rep").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(repId("negative", target.id)).setLabel("− Give rep").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(repId("history", target.id)).setLabel("History").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(repId("leaderboard")).setLabel("Leaderboard").setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

function historyPayload(target, history) {
  const lines = history.length ? history.map((vote) =>
    (vote.value > 0 ? "🟩 **+1**" : "🟥 **−1**") +
    " from <@" + vote.giverId + ">" +
    (vote.reason ? " — " + vote.reason : "") +
    " · <t:" + Math.floor(vote.createdAt.getTime() / 1000) + ":R>"
  ) : ["No reputation activity yet."];
  return {
    embeds: [new EmbedBuilder().setColor(DARK).setAuthor({ name: "AVERO • REPUTATION HISTORY" })
      .setTitle((target.globalName ?? target.username) + "'s recent reputation")
      .setDescription(lines.join("\n").slice(0, 4000))
      .setFooter({ text: "Showing the latest " + history.length + " reputation votes" })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(repId("profile", target.id)).setLabel("Back to profile").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(repId("leaderboard")).setLabel("Leaderboard").setStyle(ButtonStyle.Secondary)
    )],
    allowedMentions: { parse: [] }
  };
}

function leaderboardPayload(rows) {
  const lines = rows.length ? rows.map((row, index) => {
    const medal = ["🥇", "🥈", "🥉"][index] ?? "`#" + (index + 1) + "`";
    return medal + " <@" + row.userId + "> — **" + fmt(row.net) + "** net  (+" + fmt(row.positive) + " / −" + fmt(row.negative) + ")";
  }) : ["No reputation votes yet. Be the first to recognize someone."];
  return {
    embeds: [new EmbedBuilder().setColor(DARK).setAuthor({ name: "AVERO • SERVER RANKINGS" })
      .setTitle("Reputation leaderboard")
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Ranked by net reputation • Positive − negative" })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(repId("profile", "")).setLabel("My reputation").setStyle(ButtonStyle.Secondary)
    )],
    allowedMentions: { parse: [] }
  };
}

async function resolveUser(interaction, userId) {
  if (userId === interaction.user.id) return interaction.user;
  return interaction.guild.members.fetch(userId).then((member) => member.user);
}

async function showProfile(interaction, prisma, user) {
  const summary = await getReputationSummary(prisma, interaction.guildId, user.id);
  await interaction.reply(profilePayload(user, summary));
}

export const reputationCommand = Object.freeze({
  data: Object.freeze({
    name: "rep",
    description: "Give, view, and explore server reputation.",
    options: [
      { type: 1, name: "profile", description: "View a member's reputation.", options: [
        { type: 6, name: "member", description: "Member to inspect.", required: false }
      ] },
      { type: 1, name: "give", description: "Give positive or negative reputation.", options: [
        { type: 6, name: "member", description: "Member receiving reputation.", required: true },
        { type: 3, name: "type", description: "Choose positive or negative reputation.", required: true, choices: [
          { name: "Positive (+1)", value: "positive" }, { name: "Negative (−1)", value: "negative" }
        ] },
        { type: 3, name: "reason", description: "Required for negative reputation; keep it respectful.", required: false, max_length: 180 }
      ] },
      { type: 1, name: "history", description: "View a member's recent reputation activity.", options: [
        { type: 6, name: "member", description: "Member to inspect.", required: false }
      ] },
      { type: 1, name: "leaderboard", description: "View the server reputation leaderboard." }
    ]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Reputation requires a database connection.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Reputation is available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const action = interaction.options.getSubcommand();
    if (action === "profile") {
      const target = interaction.options.getUser("member") ?? interaction.user;
      await showProfile(interaction, prisma, target);
      return;
    }
    if (action === "give") {
      const target = interaction.options.getUser("member");
      if (target.bot) {\n        await interaction.reply({ content: "Bots cannot receive reputation.", flags: MessageFlags.Ephemeral });\n        return;\n      }\n      const type = interaction.options.getString("type");
      const value = type === "positive" ? 1 : -1;
      let result;
      try {
        result = await giveReputation(prisma, {
          guildId: interaction.guildId, giverId: interaction.user.id, receiverId: target.id,
          value, reason: interaction.options.getString("reason")
        });
      } catch (error) {
        if (error instanceof RangeError || error instanceof TypeError) {
          await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral });
          return;
        }
        throw error;
      }
      if (!result.ok) {
        await interaction.reply({ content: "You've already given reputation recently. You can vote again <t:" + Math.floor(result.retryAt.getTime() / 1000) + ":R>.", flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ content: (value > 0 ? "🟩 You gave positive reputation to " : "🟥 You gave negative reputation to ") + target + ".", allowedMentions: { users: [target.id] } });
      return;
    }
    if (action === "history") {
      const target = interaction.options.getUser("member") ?? interaction.user;
      await interaction.reply(historyPayload(target, await getReputationHistory(prisma, interaction.guildId, target.id)));
      return;
    }
    const rows = await getReputationLeaderboard(prisma, interaction.guildId);
    await interaction.reply(leaderboardPayload(rows));
  }
});

export async function handleReputationPrefix(message, prisma) {
  if (!message.guildId || message.author.bot || message.webhookId) return false;
  const match = String(message.content ?? "").trim().match(/^([+-])rep\s+<@!?([0-9]{15,22})>(?:\s+([\s\S]+))?$/i);
  if (!match) {
    if (/^[+-]rep\b/i.test(String(message.content ?? "").trim())) {
      await message.reply({ content: "Use `+rep @member` or `-rep @member a short reason`.", allowedMentions: { parse: [] } });
      return true;
    }
    return false;
  }
  const value = match[1] === "+" ? 1 : -1;
  const receiverId = match[2];
  const reason = match[3]?.trim() ?? "";
  try {
    const member = await message.guild.members.fetch(receiverId);
    const result = await giveReputation(prisma, {
      guildId: message.guildId, giverId: message.author.id, receiverId: member.id, value, reason
    });
    if (!result.ok) {
      await message.reply({ content: "You've already given reputation recently. You can vote again <t:" + Math.floor(result.retryAt.getTime() / 1000) + ":R>.", allowedMentions: { parse: [] } });
      return true;
    }
    await message.reply({
      content: (value > 0 ? "🟩 " : "🟥 ") + message.author + " gave " + (value > 0 ? "positive" : "negative") +
        " reputation to " + member + "." + (value < 0 ? "\nReason: " + reason : ""),
      allowedMentions: { users: [message.author.id, member.id] }
    });
  } catch (error) {
    const content = error instanceof RangeError || error instanceof TypeError
      ? error.message
      : "I couldn't find that server member or save the reputation vote.";
    await message.reply({ content, allowedMentions: { parse: [] } }).catch(() => {});
  }
  return true;
}

export async function handleReputationComponent(interaction, prisma) {
  const [, action, targetId] = interaction.customId.split("|");
  if (action === "negative") {
    const input = new TextInputBuilder().setCustomId("reason").setLabel("Why are you giving negative rep?")
      .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(180)
      .setPlaceholder("Keep it factual and respectful.");
    const modal = new ModalBuilder().setCustomId(repId("negative-submit", targetId)).setTitle("Give negative reputation")
      .addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return;
  }
  if (action === "negative-submit") return;
  if (action === "give") {
    const result = await giveReputation(prisma, {
      guildId: interaction.guildId, giverId: interaction.user.id, receiverId: targetId, value: 1
    });
    if (!result.ok) {
      await interaction.reply({ content: "You've already given reputation recently. You can vote again <t:" + Math.floor(result.retryAt.getTime() / 1000) + ":R>.", flags: MessageFlags.Ephemeral });
      return;
    }
    const target = await resolveUser(interaction, targetId);
    await interaction.update(profilePayload(target, await getReputationSummary(prisma, interaction.guildId, targetId), "🟩 Your positive reputation was recorded."));
    return;
  }
  if (action === "profile") {
    const target = targetId ? await resolveUser(interaction, targetId) : interaction.user;
    await interaction.update(profilePayload(target, await getReputationSummary(prisma, interaction.guildId, target.id)));
    return;
  }
  if (action === "history") {
    const target = await resolveUser(interaction, targetId);
    await interaction.update(historyPayload(target, await getReputationHistory(prisma, interaction.guildId, targetId)));
    return;
  }
  if (action === "leaderboard") {
    await interaction.update(leaderboardPayload(await getReputationLeaderboard(prisma, interaction.guildId)));
  }
}

export async function handleReputationModal(interaction, prisma) {
  const [, action, targetId] = interaction.customId.split("|");
  if (action !== "negative-submit") return false;
  const reason = interaction.fields.getTextInputValue("reason");
  const result = await giveReputation(prisma, {
    guildId: interaction.guildId, giverId: interaction.user.id, receiverId: targetId, value: -1, reason
  });
  if (!result.ok) {
    await interaction.reply({ content: "You've already given reputation recently. You can vote again <t:" + Math.floor(result.retryAt.getTime() / 1000) + ":R>.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const target = await resolveUser(interaction, targetId);
  await interaction.reply({ content: "🟥 Negative reputation recorded for " + target + ". Reason: " + reason, allowedMentions: { users: [targetId] } });
  return true;
}
