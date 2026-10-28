import { balanceCommand } from "./balance.js";
import { buyCommand } from "./buy.js";
import { dailyCommand } from "./daily.js";
import { guessCommand } from "./guess.js";
import { pingCommand } from "./ping.js";
import { rankCommand } from "./rank.js";
import { rpsCommand } from "./rps.js";
import { shopCommand } from "./shop.js";

export const commands = Object.freeze([
  pingCommand,
  rankCommand,
  balanceCommand,
  buyCommand,
  dailyCommand,
  guessCommand,
  rpsCommand,
  shopCommand
]);
