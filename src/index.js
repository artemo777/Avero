import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';

const token = process.env.DISCORD_TOKEN;

if (!token || token === 'replace_with_your_bot_token') {
  console.error(
    'Missing DISCORD_TOKEN. Add your bot token to .env locally or to your hosting provider environment variables.',
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Avero is online as ${readyClient.user.tag}`);
});

client.on(Events.Error, (error) => {
  console.error('[Discord client error]', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled promise rejection]', reason);
});

try {
  await client.login(token);
} catch (error) {
  console.error('Avero could not log in to Discord. Check the bot token and network connection.');
  console.error(error);
  process.exitCode = 1;
}
