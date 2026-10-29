# Discord authorization and test-server setup

This project uses a Discord application and bot token. A server owner or member with appropriate permissions must approve installation in Discord; repository changes alone cannot authorize a Discord account.

## 1. Authorize the bot in the test server

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and select the Avero application.
2. Under **Bot**, confirm the bot exists. Reset/regenerate the token only if needed; never paste it into chat, commit it, or put it in a public issue.
3. Under **Installation** or **OAuth2 → URL Generator** (the portal wording may vary), choose the **Guild Install** context.
4. Select these scopes: `bot` and `applications.commands`.
5. Use the minimum bot permissions needed: View Channels, Send Messages, Embed Links, Attach Files. Add **Create Expressions** when you want the bot to upload custom emoji. Creating emoji is a separate permission from editing or deleting existing expressions. Do not leave Administrator enabled just for convenience. Only add Manage Roles if you configure level-up role rewards.
6. Open the generated install URL while signed into Discord, choose **Avero Test Server**, review the requested permissions, and authorize.
7. In **Server Settings → Integrations**, verify Avero appears and check its command access.

## 2. Upload the Avero custom emoji pack

The repository includes an uploader that converts the original SVG artwork into PNG emoji, uploads the pack to your configured server, and prints the IDs for the bot to use.

On the machine where you have the repository checked out, set these values in a private local `.env` or your host's secret manager:

- `DISCORD_TOKEN`: bot token from the Developer Portal
- `DISCORD_GUILD_ID`: Avero Test Server ID

Then run from the repository root:

```sh
npm install
npm run discord:upload-emojis
```

The script uploads or reuses 15 named Avero emoji and prints `AVERO_EMOJI_*_ID` variables. Copy those printed ID lines into the same private `.env`/host environment used to run the bot. The shared `averoui/discord-emojis.js` catalogue uses those custom emoji in wallet, reward, milestone, and collectible UI, while preserving Unicode fallbacks if an ID is absent.

Never send the token to ChatGPT or commit the `.env` file. If upload fails, check that the bot is installed in the target server, `DISCORD_GUILD_ID` is correct, the bot has Create Expressions, and the server has available emoji slots.

## 3. Configure and start the bot

The project also requires a PostgreSQL database. Set these in the private runtime environment:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`: application ID
- `DISCORD_GUILD_ID`: Avero Test Server ID
- `DATABASE_URL`: PostgreSQL connection string

Then run:

```sh
npm run db:generate
npm run db:migrate:deploy
npm run register:commands
npm run bot
```

Confirm the bot is online and run `/ping` in the test server before testing economy commands.

## 4. Server icon and role icons

Custom emoji uploads are automated. The server icon and role icons are separate Discord settings and still need to be uploaded manually from PNG exports of `assets/icons/brand-mark.svg`, `assets/icons/badge.svg`, and `assets/icons/coin.svg`. Keep the original SVGs in the repository as source artwork.
