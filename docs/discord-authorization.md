# Discord authorization and test-server setup

This project uses a Discord application and bot token. Avero cannot be authorized from GitHub alone; a server owner or member with the appropriate permissions must approve installation in Discord.

## 1. Authorize the bot in the test server

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and select the Avero application.
2. Under **Bot**, confirm the bot exists. Reset/regenerate the token only if needed; never paste the token into chat, commit it, or put it in a public issue.
3. Under **Installation** or **OAuth2 → URL Generator** (the portal wording may vary), choose the **Guild Install** context.
4. Select only these scopes for the current bot: `bot` and `applications.commands`.
5. Choose the minimum bot permissions required by the features you want to test:
   - View Channels
   - Send Messages
   - Embed Links
   - Attach Files (Avero panels can attach rendered PNG artwork)
   - Read Message History (only if needed for the intended channel workflow)
   - Use External Emojis only if the bot must display emoji from other servers
   - Manage Expressions only if the bot itself will upload/manage custom server emoji; otherwise upload emoji manually as a server administrator and do not grant this permission
6. Open the generated install URL while signed into Discord, choose **Avero Test Server**, review the requested permissions, and authorize. Only install into a server you own or are authorized to administer.
7. In **Server Settings → Integrations**, verify Avero appears and check its command access. Make sure its highest role is below any roles it may be expected to manage.

Do not grant Administrator just to make setup easier. Level-up role rewards, if enabled, separately require Manage Roles and reward roles below Avero's highest role; do not enable that permission unless you're configuring those features.

## 2. Configure the bot runtime

On the machine or hosting service where Avero runs, set the following environment variables using the private deployment settings:

- `DISCORD_TOKEN`: bot token from the Developer Portal
- `DISCORD_CLIENT_ID`: application ID
- `DISCORD_GUILD_ID`: Avero Test Server ID, if using the optional server-specific command cleanup
- `DATABASE_URL`: PostgreSQL connection string

Keep secrets in the host's secret/environment-variable manager or a local untracked `.env`. Never send a bot token in chat or add it to GitHub.

Then run:

```sh
npm install
npm run db:generate
npm run db:migrate:deploy
npm run register:commands
npm run bot
```

The database migration must be applied to the intended database. Confirm the process is online and run `/ping` in the test server before testing economy commands.

## 3. Upload the Avero visual assets

The repository contains the original SVG assets. Upload the selected icons from Discord's server settings, converting SVGs to transparent PNG where Discord requires raster images. For custom emoji, use the names in `docs/discord-asset-rollout.md`. This is a manual server-owner action unless a separately configured bot is granted the relevant permission and implemented to upload the files.

## Current limitation

No Discord authorization has been completed by this repository change. An authorized Discord session and access to the Developer Portal are required for the approval step; a bot token is required only on the private runtime host. Do not share either credential in this chat.
