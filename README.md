# Avero

Avero is a Discord bot built with JavaScript, ES modules, and discord.js.

## Runtime and packages

- **Node.js:** 24 LTS (use the newest 24.x LTS patch offered by your host).
- **discord.js:** 14.27.0
- **dotenv:** 18.0.8

Versions are pinned intentionally so installs are repeatable instead of silently changing when a new package release appears. Re-check official release pages before upgrading.

## Run locally

1. Install Node.js 24 LTS.
2. Clone this repository and enter its folder.
3. Install dependencies with `npm install`.
4. Copy `.env.example` to `.env`.
5. Fill in `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` in your local `.env`.
6. Start the bot with `npm start`.

Use `npm run dev` for Node's built-in watch mode, or `npm run check` to syntax-check the entry point.

## eCloudServ

- Select a Node.js 24.x runtime if the panel offers it.
- Set the startup command to `npm start` if the panel asks for one.
- Add `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` as environment variables in the host panel.
- `DISCORD_GUILD_ID` is optional for future development/testing of server-specific slash commands.
- Do not upload or commit a real `.env` file or share your bot token in chat.

## Current scope

This is only the minimal foundation: Discord client startup, a ready log, basic client error reporting, environment configuration, and secret-file ignore rules. No commands or feature modules have been added yet.

The client currently requests only the `Guilds` gateway intent. Additional intents and permissions should be enabled only when a feature actually needs them.
