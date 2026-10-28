import { balanceCommand } from "./balance.js";
import { dailyCommand } from "./daily.js";
import { guessCommand } from "./guess.js";
import { pingCommand } from "./ping.js";
import { rankCommand } from "./rank.js";

export const commands = Object.freeze([
  pingCommand,
  rankCommand,
  balanceCommand,
  dailyCommand,
  guessCommand
]);
