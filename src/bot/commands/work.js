import { MessageFlags } from "discord.js";
import { createGamePanel, gamePayload, renderWorkJobsPage } from "../game-ui.js";
import { getCurrencyPurchases } from "../../db/currency-repository.js";
import { WORK_JOBS, WORK_PROMOTION_THRESHOLDS } from "../work-catalog.js";
import { applyForJob, getMemberJob, resignFromJob, runJobShift } from "../../db/work-repository.js";

function panel(title, description) {
  return gamePayload(createGamePanel({
    title, description, eyebrow: "AVERO WORK", footer: "VIRTUAL COINS ONLY"
  }));
}


export const workCommand = Object.freeze({
  data: Object.freeze({
    name: "work",
    description: "Browse careers, apply, and earn coins from shifts.",
    options: [
      { type: 1, name: "list", description: "Browse careers in pages of five." },
      { type: 1, name: "apply", description: "Apply for a career.", options: [{ type: 3, name: "job", description: "Choose a career.", required: true, choices: WORK_JOBS.map((job) => ({ name: job.name, value: job.id })) }] },
      { type: 1, name: "shift", description: "Complete a shift and earn your salary." },
      { type: 1, name: "info", description: "View your job, shifts, and promotions." },
      { type: 1, name: "resign", description: "Leave your current job." }
    ]
  }),
  async execute(interaction, { prisma } = {}) {
    if (!prisma) throw new Error("Work command requires a database client.");
    if (!interaction.guildId) {
      await interaction.reply({ content: "Work is available inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const action = interaction.options.getSubcommand();
    if (action === "list") return interaction.reply(await renderWorkJobsPage(interaction.user.id, 0));
    if (action === "apply") {
      const jobId = interaction.options.getString("job", true);
      const result = await applyForJob(prisma, interaction.guildId, interaction.user.id, jobId);
      const description = result.applied
        ? "**" + result.job.name + "** · " + result.job.salary + " coins/shift\n" + result.job.description + "\n\nYour first promotion is at 10 completed shifts."
        : result.reason === "employed" ? "You're already working as **" + result.current.jobId.replaceAll("_", " ") + "**. Resign first to change careers."
          : "You're already employed as **" + result.job.name + "**.";
      return interaction.reply(panel(result.applied ? "Application accepted" : "Already employed", description));
    }
    if (action === "info") {
      const current = await getMemberJob(prisma, interaction.guildId, interaction.user.id);
      if (!current) return interaction.reply(panel("No active job", "Browse /work list and apply for a career to get started."));
      const job = WORK_JOBS.find((entry) => entry.id === current.jobId);
      const next = WORK_PROMOTION_THRESHOLDS[current.promotions] ?? null;
      const stars = "★".repeat(current.promotions) + "☆".repeat(3 - current.promotions);
      return interaction.reply(panel(job.name + " " + stars, current.shifts + " shifts completed · " + current.promotions + "/3 promotions\nSalary: " + Math.round(job.salary * (1 + current.promotions * 0.15)) + " coins/shift\n" + (next ? (next - current.shifts) + " shifts to next promotion." : "Top rank reached.")));
    }
    if (action === "resign") {
      const result = await resignFromJob(prisma, interaction.guildId, interaction.user.id);
      return interaction.reply(panel(result.resigned ? "Career ended" : "No active job", result.resigned ? "You left your role. Your completed-shift history ends here." : "You don't have a job to resign from."));
    }
    if (action === "shift") {
      const purchases = await getCurrencyPurchases(prisma, interaction.guildId, interaction.user.id);
      const ownedTools = new Set(purchases.map((purchase) => purchase.itemId));
      const result = await runJobShift(prisma, interaction.guildId, interaction.user.id, {
        cooldownMs: ownedTools.has("hourglass") ? 55 * 60 * 1000 : undefined,
        bonusCoins: ownedTools.has("repair_kit") ? 5 : 0
      });
      const description = result.worked
        ? "**+" + result.salary.toLocaleString("en-US") + " coins** · " + result.job.name + "\nWallet: **" + result.account.balance.toLocaleString("en-US") + "**\n" + result.current.shifts + " shifts · " + "★".repeat(result.current.promotions) + "☆".repeat(3 - result.current.promotions) +
          (result.promoted ? "\n\n★ Promotion earned! Your next shift pays more." : "")
        : result.reason === "not_employed" ? "Apply for a career first with /work list."
          : "Next shift <t:" + Math.floor(result.nextAt.getTime() / 1000) + ":R>.";
      return interaction.reply(panel(result.worked ? "Shift complete" : "Work unavailable", description));
    }
  }
});
