import { balanceCommand } from "./balance.js";
import { buyCommand } from "./buy.js";
import { dailyCommand } from "./daily.js";
import { guessCommand } from "./guess.js";
import { helpCommand } from "./help.js";
import { inventoryCommand } from "./inventory.js";
import { gamesCommand } from "./games.js";
import { leaderboardCommand } from "./leaderboard.js";
import { pingCommand } from "./ping.js";
import { profileCommand } from "./profile.js";
import { rankCommand } from "./rank.js";
import { rpsCommand } from "./rps.js";
import { shopCommand } from "./shop.js";
import { scavengeCommand } from "./scavenge.js";
import { workCommand } from "./work.js";

export const commands = Object.freeze([
  pingCommand,
  helpCommand,
  rankCommand,
  profileCommand,
  leaderboardCommand,
  balanceCommand,
  buyCommand,
  dailyCommand,
  guessCommand,
  inventoryCommand,
  gamesCommand,
  rpsCommand,
  shopCommand,
  workCommand,
  scavengeCommand
]);
