import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { createEngaugeClient } from "../engauge-api.js";
import { SHOP_ITEMS } from "../shop-catalog.js";
import { adjustAdminCurrency, adjustAdminInventory, recordAdminXpGrant } from "../../db/admin-economy-repository.js";
import { getCurrencyAccount, getCurrencyPurchases } from "../../db/currency-repository.js";

const engauge = createEngaugeClient();
const ACTION_CHOICES = [
  { name: "Add", value: "add" },
  { name: "Remove", value: "remove" },
  { name: "Set", value: "set" }
];
const ITEM_ACTION_CHOICES = [
  { name: "Grant", value: "grant" },
  { name: "Remove", value: "remove" }
];
const CURRENCY_CHOICES = [
  { name: "Coins", value: "coins" },
  { name: "Gems", value: "gems" }
];

function canManageEconomy(interaction) {
  const permissions = interaction.memberPermissions ?? interaction.member?.permissions;
  return Boolean(
    permissions?.has(PermissionFlagsBits.Administrator) ||
    permissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

function response(content) {
  return { content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
}

export const adminCommand = Object.freeze({
  data: Object.freeze({
    name: "admin",
    description: "Admin-only Avero economy controls.",
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    dm_permission: false,
    options: [
      {
        type: 1, name: "coins", description: "Add, remove or set a member's coins or gems.",
        options: [
          { type: 6, name: "member", description: "Member to adjust.", required: true },
          { type: 3, name: "action", description: "Choose how to adjust the balance.", required: true, choices: ACTION_CHOICES },
          { type: 4, name: "amount", description: "Amount (0–1,000,000 for Set; otherwise 1–1,000,000).", required: true, min_value: 0, max_value: 1_000_000 },
          { type: 3, name: "currency", description: "Wallet currency.", required: false, choices: CURRENCY_CHOICES },
          { type: 3, name: "reason", description: "Optional audit note.", required: false, max_length: 200 }
        ]
      },
      {
        type: 1, name: "item", description: "Grant or remove a shop collectible.",
        options: [
          { type: 6, name: "member", description: "Member whose inventory to change.", required: true },
          { type: 3, name: "action", description: "Grant or remove ownership.", required: true, choices: ITEM_ACTION_CHOICES },
          { type: 3, name: "item", description: "Shop item to change.", required: true, autocomplete: true },
          { type: 3, name: "reason", description: "Optional audit note.", required: false, max_length: 200 }
        ]
      },
      {
        type: 1, name: "inspect", description: "Inspect a member's saved wallet and inventory records.",
        options: [
          { type: 6, name: "member", description: "Member whose economy records to inspect.", required: true }
        ]
      },
      {
        type: 1, name: "xp", description: "Grant XP through Engauge (levels update naturally).",
        options: [
          { type: 6, name: "member", description: "Member to award XP to.", required: true },
          { type: 4, name: "amount", description: "XP to grant (1–1,000,000).", required: true, min_value: 1, max_value: 1_000_000 },
          { type: 3, name: "reason", description: "Optional audit note.", required: false, max_length: 200 }
        ]
      }
    ]
  }),
  async autocomplete(interaction) {
    const query = interaction.options.getFocused().trim().toLocaleLowerCase();
    const matches = SHOP_ITEMS.filter((item) =>
      [item.name, item.id, item.category].join(" ").toLocaleLowerCase().includes(query)
    ).slice(0, 25);
    await interaction.respond(matches.map((item) => ({
      name: (item.name + " · " + item.id).slice(0, 100),
      value: item.id
    })));
  },
  async execute(interaction, { prisma } = {}) {
    if (!interaction.guildId || !prisma) {
      await interaction.reply(response("Admin economy controls require a server database context."));
      return;
    }
    if (!canManageEconomy(interaction)) {
      await interaction.reply(response("You need Manage Server or Administrator permission to use this command."));
      return;
    }
    const subcommand = interaction.options.getSubcommand();
    const target = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason") ?? null;

    if (subcommand === "inspect") {
      const [account, purchases] = await Promise.all([
        getCurrencyAccount(prisma, interaction.guildId, target.id),
        getCurrencyPurchases(prisma, interaction.guildId, target.id)
      ]);
      const updated = account?.updatedAt
        ? new Date(account.updatedAt).toISOString().replace("T", " ").slice(0, 16) + " UTC"
        : "no wallet row";
      await interaction.reply(response(
        "**Economy records · " + target.username + "**\\n" +
        "Coins: **" + (account?.balance ?? 0).toLocaleString("en-US") + "** · Gems: **" +
        (account?.gemBalance ?? 0).toLocaleString("en-US") + "**\\n" +
        "Inventory records: **" + purchases.length + "**\\n" +
        "Wallet last updated: **" + updated + "**\\n" +
        (account ? "Wallet row exists in the global member scope." : "No wallet row exists in the current database.")
      ));
      return;
    }

    if (subcommand === "coins") {
      const action = interaction.options.getString("action", true);
      const amount = interaction.options.getInteger("amount", true);
      const currency = interaction.options.getString("currency") ?? "coins";
      const result = await adjustAdminCurrency(
        prisma, interaction.guildId, target.id, interaction.user.id, currency, action, amount, reason
      );
      if (!result.updated) {
        await interaction.reply(response("That member only has " + result.previous.toLocaleString("en-US") + " " + currency + ". Nothing was changed."));
        return;
      }
      await interaction.reply(response(
        (action === "set" ? "Set " : action === "add" ? "Added " : "Removed ") +
        Math.abs(result.delta).toLocaleString("en-US") + " " + currency + " for " + target.username +
        ". New balance: **" + result.balance.toLocaleString("en-US") + "**. This action was recorded."
      ));
      return;
    }

    if (subcommand === "item") {
      const action = interaction.options.getString("action", true);
      const itemId = interaction.options.getString("item", true);
      const item = SHOP_ITEMS.find((candidate) => candidate.id === itemId);
      if (!item) {
        await interaction.reply(response("That item is not in the Avero shop."));
        return;
      }
      const result = await adjustAdminInventory(
        prisma, interaction.guildId, target.id, interaction.user.id, item.id, action, reason
      );
      if (!result.updated) {
        await interaction.reply(response(result.reason === "already_owned"
          ? target.username + " already owns " + item.name + "."
          : target.username + " does not own " + item.name + "."));
        return;
      }
      await interaction.reply(response(
        (action === "grant" ? "Granted " : "Removed ") + item.name + " " +
        (action === "grant" ? "to " : "from ") + target.username + ". This action was recorded."
      ));
      return;
    }

    if (subcommand === "xp") {
      const amount = interaction.options.getInteger("amount", true);
      const before = await engauge.getMember(interaction.guildId, target.id);
      await engauge.addMemberXp(interaction.guildId, target.id, amount);
      const after = await engauge.getMember(interaction.guildId, target.id);
      await recordAdminXpGrant(prisma, interaction.guildId, target.id, interaction.user.id, amount, reason);
      const level = Number(after?.level ?? before?.level ?? 0);
      const xp = Number(after?.xp ?? after?.totalXp ?? before?.xp ?? before?.totalXp ?? 0);
      await interaction.reply(response(
        "Granted **" + amount.toLocaleString("en-US") + " XP** to " + target.username +
        ". Current level: **" + level.toLocaleString("en-US") + "** · XP: **" +
        xp.toLocaleString("en-US") + "**. Engauge remains the source of truth; the new XP may advance their level."
      ));
    }
  }
});
