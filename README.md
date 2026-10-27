# Avero

A Node.js Discord bot foundation with a small HTTP health-check service and a shared `averoui/` response-style toolkit.

## Requirements

- Node.js 20 or newer
- npm
- A Discord application and bot token from the Discord Developer Portal
- PostgreSQL for persistent member data

## Setup

1. Clone the repository and enter the project directory.
2. Copy the example environment file and fill in the Discord application values and PostgreSQL connection string:

   ```sh
   cp .env.example .env
   ```

3. Install dependencies and generate the Prisma client:

   ```sh
   npm install
   npm run db:generate
   ```

4. Apply database migrations to the configured PostgreSQL database:

   ```sh
   npm run db:migrate:deploy
   ```

5. Register the slash commands:

   ```sh
   npm run register:commands
   ```

   Set `DISCORD_GUILD_ID` to register to one test server; omit it to register globally.

6. Start the bot:

   ```sh
   npm run bot
   ```

The bot needs `DISCORD_TOKEN`. Command registration also needs `DISCORD_CLIENT_ID`. Database features need `DATABASE_URL`. Never commit real credentials or your local `.env` file.

## Included command

- `/ping` — checks whether Avero is responding and returns an embed styled through `averoui/`.

## Persistence foundation

Avero uses PostgreSQL through Prisma. The first schema adds a `MemberProfile` per guild/user pair with XP, level, and the last message XP timestamp. The repository helpers support looking up and ensuring profiles, plus atomic XP increments. They are not wired to message events yet; leveling and role rewards will be added as a separate tested increment.

## HTTP health server

The existing health-check server remains separate from the Discord bot:

```sh
npm start
```

It listens on port `3000` by default. Set `PORT` to change it; valid values are integers from 1 through 65535.

- `GET /health` — returns JSON indicating that the service is running.
- Any other route — returns a JSON `404 Not Found` response.

## Shared AveroUI

Use `averoui/index.js` as the public entry point for shared colors, semantic icons, Discord timestamps, Markdown escaping, validated mentions, HTTPS links, and embed payloads. New commands should use these helpers instead of defining their own visual style.

## Tests

Run the built-in Node.js test suite:

```sh
npm run db:generate
npm test
```

## Project structure

```text
.
├── averoui/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── db/
│   ├── bot/
│   │   ├── commands/
│   │   ├── command-registry.js
│   │   └── config.js
│   ├── bot.js
│   ├── register-commands.js
│   ├── app.js
│   ├── config.js
│   └── server.js
└── test/
```

Leveling, games, leaderboards, boosts, donations, and voting will be added in separate tested increments.
