import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { SHOP_ITEMS } from "../shop-catalog.js";
import { adjustAdminInventory, recordAdminXpGrant } from "../../db/admin-economy-repository.js";

const ITEM_ACTION_CHOICES = [
  { name: "Grant", value: "grant" },
  { name: "Remove", value: "remove" }
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
    description: "Admin-only Avero progression and inventory controls.",
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    dm_permission: false,
    options: [
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
        type: 1, name: "xp", description: "Grant Avero XP (levels update naturally).",
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
      const [accounts, purchases] = await Promise.all([
        prisma.currencyAccount.findMany({
          where: { userId: target.id },
          select: { guildId: true, balance: true, gemBalance: true, updatedAt: true }
        }),
        prisma.currencyPurchase.findMany({
          where: { userId: target.id },
          select: { guildId: true, itemId: true, purchasedAt: true }
        })
      ]);
      const globalAccount = accounts.find((account) => account.guildId === "__avero_global__");
      const globalItems = purchases.filter((item) => item.guildId === "__avero_global__");
      const legacyWallets = accounts.filter((account) => account.guildId !== "__avero_global__");
      const legacyItems = purchases.filter((item) => item.guildId !== "__avero_global__");
      const updated = globalAccount?.updatedAt
        ? new Date(globalAccount.updatedAt).toISOString().replace("T", " ").slice(0, 16) + " UTC"
        : "no global wallet row";
      await interaction.reply(response(
        "**Economy records · " + target.username + "**\\n" +
        "Global wallet: **" + (globalAccount?.balance ?? 0).toLocaleString("en-US") + "** coins · **" +
        (globalAccount?.gemBalance ?? 0).toLocaleString("en-US") + "** gems\\n" +
        "Global inventory items: **" + globalItems.length + "**\\n" +
        "Legacy wallet rows: **" + legacyWallets.length + "** · Legacy inventory rows: **" + legacyItems.length + "**\\n" +
        "Global wallet last updated: **" + updated + "**\\n" +
        (globalAccount || globalItems.length
          ? "Global economy records exist in the active database."
          : "No global economy records exist in the active database.") +
        ((legacyWallets.length || legacyItems.length)
          ? "\\nLegacy-scoped records were found. Do not delete them; they may be recoverable."
          : "")
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
      const profile = await recordAdminXpGrant(prisma, interaction.guildId, target.id, interaction.user.id, amount, reason);
      await interaction.reply(response("Granted **" + amount.toLocaleString("en-US") + " XP** to " + target.username + ". Current level: **" + profile.level.toLocaleString("en-US") + "** · XP: **" + profile.xp.toLocaleString("en-US") + "**. Avero saved the update."));
    }
  }
});
