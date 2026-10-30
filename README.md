# Avero

A Node.js Discord bot with a shared AveroUI toolkit for consistent, polished Discord responses.

Avero can operate in any Discord server where it is installed and has the required permissions. Slash commands are registered globally. Game data is scoped by Discord server, so each server has its own balances, cooldowns, and future game records.

## Requirements

- Node.js 20 or newer
- npm
- A Discord application and bot token from the Discord Developer Portal
- PostgreSQL for persistent member and currency data

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

   Registration publishes slash commands globally. If `DISCORD_GUILD_ID` is set, the script also removes server-specific copies of commands that now exist globally (for example old `/ping` and `/rank` copies), while preserving unrelated server-only commands. Set it to your test server ID when cleaning up duplicates. Discord may take a while to propagate global command updates.

6. Start the bot:

   ```sh
   npm run bot
   ```

The bot needs `DISCORD_TOKEN`. Command registration also needs `DISCORD_CLIENT_ID`. Database features need `DATABASE_URL`. Never commit real credentials or your local `.env` file.

## Included commands

- `/ping` — checks interaction and gateway latency.
- `/help` — groups the available commands by category.
- `/rank [member]` — shows level, total XP, and progress toward the next level.
- `/profile [member]` — combines wallet, XP, and collection progress.
- `/leaderboard [category]` — shows the server's top coin, XP, combined Games, Guess, or Rock-paper-scissors rankings. Game boards include wins, losses, ties where applicable, and win rate.
- `/balance` — shows your Avero coin balance in the current server.
- `/daily` — claims 100 coins once per 24-hour cooldown.
- `/work` — complete a community-themed shift for 60–120 coins every 30 minutes.
- `/scavenge` — search every 10 minutes for 25–55 coins and a chance at a collectible; duplicate finds grant a coin bonus.
- `/guess number` — guess a number from 1 to 5 to earn 25 coins on a win, with one 25-coin reward every 10 minutes to limit coin farming. Playing is free.
- `/rps choice` — play rock-paper-scissors for free. Wins, losses, and ties are tracked on profiles and the Games leaderboard; the game does not change coin balances.
- `/games` — open the button-driven quick-play hub.
- `/shop` — browse six collectible badges and relics with rarity labels and prices.
- `/buy item` — purchase a collectible once; purchases are saved and coins are deducted atomically.
- `/inventory` — browse your server collection with pagination, per-item detail panels, and collection milestones (First Find, Curator, Full Set); unowned collectibles can be unlocked directly from their detail view.

Currency is virtual and has no cash value. Each server has a separate wallet for each user. Daily claims, work shifts, scavenge rewards, game rewards, and shop purchases are recorded in the transaction ledger. Free games never deduct coins to enter. Shop purchases are virtual collectibles only, cannot be bought twice, and never allow a balance to go negative. Successful game, wallet, shop, and collection responses are public by default; private replies are reserved for invalid contexts and purchase/cooldown feedback.

## Profile customization roadmap

The collectible shop is the foundation for a more expressive Avero profile system. Planned work is intentionally staged so the economy and ownership rules are reliable before profile rendering is added.

- **Profile cards:** evolve the compact `/profile` summary into a shareable card with avatar, XP progress, coins, selected stats, badges, title, and bio.
- **Customization inventory:** buy and equip profile themes, color accents, icons, frames, badges, titles, and static or animated backgrounds. Owned items and equipped items should be separate concepts.
- **Free and premium-style unlocks:** some options will be free; others can be earned or bought with virtual coins. Any future donor, funder, voter, or server-booster perks should be granted from verified server/platform data, not self-declared text.
- **Rendering:** games and currency panels now use a shared canvas-rendered hero graphic. Profile cards can reuse this renderer later; keep the first profile-card version static before considering animated backgrounds.
- **Server boundaries:** balances, purchases, equipped cosmetics, and supporter perks should be scoped explicitly to a server unless a later design decision says otherwise.

These are roadmap items, not implemented features yet. Owned collectibles can be equipped as a profile badge from an item detail panel. Only items already in the member’s collection can be equipped; the selected badge is persisted per server and appears as a small icon beside the username on `/profile`. The selection can be removed from the same item detail panel.

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

Avero uses PostgreSQL through Prisma. `MemberProfile` stores one profile per guild/user pair, including the optional equipped badge item ID. `CurrencyAccount` stores one wallet per guild/user pair, including daily, work, scavenge, and game-reward cooldown timestamps. `CurrencyTransaction` records coin changes with the server, member, reason, and timestamp. `CurrencyPurchase` records collectible ownership per server and member. The database migration is not applied automatically; run the migration command above against your configured database.

## Shared AveroUI assets

Reusable visual assets live in one place instead of being scattered through commands:

- `averoui/icons.js` — small text-safe glyphs used in Discord UI.
- `averoui/assets.js` — shared asset catalogue with IDs, intended uses, and source/licence notes for artwork. Import `ASSETS`, `getAsset(id)`, or `listAssets({ kind })`.
- `assets/icons/` — original Avero SVGs for the coin, rarity gems, brand mark, and six individually illustrated shop collectibles (Neon Badge, Vault Badge, Starlight Badge, Moonlit Token, Prism Crown, and Avero Relic). Use `loadRegisteredAsset("coin")` or `loadAssetBuffer("icons/coin.svg")` from `averoui/asset-loader.js`; paths are restricted to this folder.
- `averoui/canvas.js` — generated artwork when a panel needs custom Avero-branded art rather than a static image.
- `averoui/render-asset.js` — converts registered SVG files to PNG buffers for Discord attachments. Item-detail panels use registered collectible artwork; compact profile and shop panels avoid oversized decorative galleries.
- Economy UI consumes shared asset-symbol and rarity mappings in wallet, shop, item-detail, and inventory panels. The shop lists each collectible with its Details and Buy controls immediately underneath; inventory stays compact with item buttons and pagination, while item-detail panels show the selected collectible illustration. Registered SVGs are rasterized to PNG attachments at runtime with `renderRegisteredAsset`, so the SVG files remain the source artwork. Generated canvas hero panels also include a branded coin motif.

This is intentionally a version-controlled asset library, not a new database table: static icons and artwork don't need database storage. A database can be added later only if assets need to be uploaded or managed dynamically while the bot is running. For downloaded assets, record the source and licence before committing; original AI-generated or canvas-drawn Avero art is usually the simplest way to keep the visual style consistent. No external files are downloaded at runtime.

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
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── db/
│   │   ├── client.js
│   │   ├── currency-repository.js
│   │   └── member-repository.js
│   ├── bot/
│   │   ├── commands/
│   │   ├── command-registry.js
│   │   ├── economy-rules.js
│   │   ├── config.js
│   │   └── leveling.js
│   ├── bot.js
│   ├── register-commands.js
│   ├── app.js
│   └── server.js
└── test/
```

RPS is the first Duel Deck game. The prioritized next increments are Daily Contracts, The Vault, achievements and cosmetic profile items; see [the games and currency finish plan](docs/games-currency-roadmap.md). These remain separate from the paused leveling migration.
