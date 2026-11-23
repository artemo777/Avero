// eCloudServ's locked startup command routes .js files through ts-node --esm.
// Keep this entrypoint compatible with that command by forwarding to Avero's bot.
import "./bot.js";
