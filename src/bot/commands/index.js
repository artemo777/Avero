import { balanceCommand } from "./balance.js";
import { coinflipCommand } from "./coinflip.js";
import { dailyCommand } from "./daily.js";
import { pingCommand } from "./ping.js";
import { rankCommand } from "./rank.js";

export const commands = Object.freeze([
  pingCommand,
  rankCommand,
  balanceCommand,
  dailyCommand,
  coinflipCommand
]);
