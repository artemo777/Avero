import { achievementsCommand } from "./achievements.js";
import { adminCommand } from "./admin.js";
import { activityCommand } from "./activity.js";
import { autoresponderCommand } from "./autoresponder.js";
import { askCommand } from "./ask.js";
import { balanceCommand } from "./balance.js";
import { buyCommand } from "./buy.js";
import { configCommand } from "./config.js";
import { dailyCommand } from "./daily.js";
import { contractsCommand } from "./contracts.js";
import { collectionsCommand } from "./collections.js";
import { coinflipCommand } from "./coinflip.js";
import { guessCommand } from "./guess.js";
import { helpCommand } from "./help.js";
import { inventoryCommand } from "./inventory.js";
import { gamesCommand } from "./games.js";
import { leaderboardCommand } from "./leaderboard.js";
import { perksCommand } from "./perks.js";
import { pingCommand } from "./ping.js";
import { profileCommand } from "./profile.js";
import { rankCommand } from "./rank.js";
import { rpsCommand } from "./rps.js";
import { shopCommand } from "./shop.js";
import { scavengeCommand } from "./scavenge.js";
import { setupCommand } from "./setup.js";
import { workCommand } from "./work.js";
import { vaultCommand } from "./vault.js";
import { titlesCommand } from "./titles.js";
import { reputationCommand } from "./reputation.js";

export const commands = Object.freeze([
  pingCommand,
  helpCommand,
  adminCommand,
  configCommand,
  activityCommand,
  autoresponderCommand,
  perksCommand,
  achievementsCommand,
  profileCommand,
  rankCommand,
  leaderboardCommand,
  balanceCommand,
  askCommand,
  buyCommand,
  dailyCommand,
  contractsCommand,
  collectionsCommand,
  coinflipCommand,
  guessCommand,
  inventoryCommand,
  gamesCommand,
  rpsCommand,
  shopCommand,
  workCommand,
  scavengeCommand,
  vaultCommand,
  titlesCommand,
  setupCommand,
  reputationCommand
]);
