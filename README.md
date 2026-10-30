# Avero

A Node.js Discord bot with a shared AveroUI toolkit for consistent, polished Discord responses.

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

## Included commands

- `/ping` — checks the interaction and gateway latency with a styled Components V2 status panel.
- `/rank [member]` — shows the selected member's level, total XP, and progress toward the next level.

## Leveling and role rewards

Avero awards a random amount of XP for eligible guild messages. The defaults are 15–25 XP and a 60-second per-member cooldown; both are configurable. Bot messages and direct messages are ignored. XP and cooldown timestamps are stored in PostgreSQL, and levels keep the square progression: level `n` starts at `100 × n²` XP.

Configure leveling with these optional environment variables:

- `LEVEL_UP_CHANNEL_ID` — Discord text channel for level-up announcements. If unset, announcements go to the channel where the XP was earned.
- `LEVEL_XP_COOLDOWN_MS` — per-member XP cooldown in milliseconds (default: `60000`).
- `LEVEL_MIN_MESSAGE_XP` and `LEVEL_MAX_MESSAGE_XP` — inclusive random XP range (defaults: `15` and `25`).

The cooldown and XP bounds must be positive whole numbers, and the maximum XP must be at least the minimum XP. A configured announcement channel must be accessible to Avero and support messages.

Optional milestone role rewards can be configured in `LEVEL_ROLE_REWARDS` as a JSON object mapping levels to role IDs, for example:

```dotenv
LEVEL_ROLE_REWARDS={"5":"123456789012345678","10":"234567890123456789"}
```

The bot must have permission to manage roles, and each reward role must be below Avero's highest role in that server. Configure reward role IDs that exist in the server where you intend to use them.

## Persistence

Avero uses PostgreSQL through Prisma. The `MemberProfile` table stores one profile per guild/user pair, including XP, level, and the last message XP timestamp. The database migration is not applied automatically; run the migration command above against your configured database.


## Import existing Engauge levels

The Engauge migration tool reads member XP from the Engauge API for server `1434292419788017766` and imports it into Avero's `MemberProfile` records. It is intentionally **dry-run by default**. It preserves whichever is higher: Engauge XP or existing Avero XP, and calculates Avero levels from Avero's `100 × level²` curve. It does not issue Discord announcements or role rewards.

Before running it:
1. Make sure `DATABASE_URL` points to the intended PostgreSQL database and its migrations are applied.
2. Add the private Codespaces secret `ENGAUGE_API_TOKEN`. Never put the token in a file, source code, terminal command, or commit.
3. Set `ENGAUGE_SERVER_ID` only if importing a different server; the default is the server above.
4. Restart an existing Codespace after adding/changing its secrets so the environment can receive them.

Preview only (does not write profiles):

```sh
npm run db:generate
npm run migrate:engauge
```

Review the member counts and XP total printed by the preview. Only after confirming the target server and database, apply the import:

```sh
npm run migrate:engauge -- --apply
```

The API token is broad-access and Engauge currently documents tokens as experimental. Keep it private and do not paste it into chat or logs. The importer never prints the token or API response bodies.

## HTTP health server

The existing health-check server remains separate from the Discord bot:

```sh
npm start
```

It listens on port `3000` by default. Set `PORT` to change it; valid values are integers from 1 through 65535.

- `GET /health` — returns JSON indicating that the service is running.
- Any other route — returns a JSON `404 Not Found` response.

## Shared AveroUI

Import shared helpers from `averoui/index.js`. The toolkit centralizes:

- A deep violet, teal, and slate color palette.
- Unicode-only semantic glyphs instead of default emoji.
- Components V2 panels with accent colors, text displays, and consistent separators.
- Discord timestamps, Markdown escaping, validated mentions, HTTPS links, and embed payload validation.

Use `createPanel({ eyebrow, title, description, sections, footer, accentColor })` for a consistent Components V2 layout. Send it using `flags: MessageFlags.IsComponentsV2` and `components: [panel]`. New commands should reuse AveroUI rather than inventing one-off styles.

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
│   ├── components.js
│   ├── embeds.js
│   ├── icons.js
│   ├── index.js
│   ├── links.js
│   ├── mentions.js
│   ├── text.js
│   ├── theme.js
│   └── timestamps.js
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── db/
│   ├── bot/
│   │   ├── commands/
│   │   ├── command-registry.js
│   │   ├── config.js
│   │   └── leveling.js
│   ├── bot.js
│   ├── register-commands.js
│   ├── app.js
│   ├── config.js
│   └── server.js
└── test/
```

Games, leaderboards, boosts, donations, and voting will be added in separate tested increments.
