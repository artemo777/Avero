# Avero

A Node.js Discord bot with a shared AveroUI toolkit for consistent, polished Discord responses.

Avero can operate in any Discord server where it is installed and has the required permissions. All slash commands are registered globally. Wallets, inventory, cosmetics, career, titles, cooldowns, and game history are global per member. XP, levels, and imported message/voice statistics are server-scoped.

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

4. Apply database migrations to the configured development/test PostgreSQL database:

   ```sh
   npm run db:migrate:deploy
   ```

5. Register Avero's slash commands globally:

   ```sh
   npm run register:commands
   ```

   This replaces the application's global slash-command set. If the app has old server-scoped copies, set the optional `DISCORD_GUILD_ID` to one affected server before registration; the script removes only same-named legacy copies from that server. It does not register server-scoped commands. Global command updates can take time to appear in Discord.

6. Start the Discord bot:

   ```sh
   npm run bot
   ```

The bot needs `DISCORD_TOKEN`. Global command registration also needs `DISCORD_CLIENT_ID`. Database features need `DATABASE_URL`. Never commit real credentials or your local `.env` file. Always verify that `DATABASE_URL` points to a development/test database before applying migrations.

## Moving XP from Engauge

Avero now stores server XP, levels, message totals, voice time, and imported currency in its own PostgreSQL database. Runtime XP awards, `/rank`, `/leaderboard`, and `/admin xp` use Avero's database; the running bot no longer needs an Engauge API token.

To migrate the existing server once:

1. Back up the Avero PostgreSQL database.
2. Set `ENGAUGE_API_TOKEN` and `ENGAUGE_SERVER_ID` in the one-time migration environment. Never paste the token into chat or commit it.
3. Apply the new schema and regenerate Prisma:
   ```sh
   npm run db:migrate:deploy
   npm run db:generate
   ```
4. Preview the Engauge export without writing anything:
   ```sh
   npm run db:import-engauge
   ```
5. If the server ID, member count, and totals look correct, run the import:
   ```sh
   npm run db:import-engauge -- --apply
   ```
6. Verify several members with `/rank` and check `/leaderboard xp`. Only after verification remove the Engauge token from the migration environment.

The importer fetches all pages before writing, skips invalid Discord IDs, and uses insert-only writes so rerunning it does not overwrite existing Avero progression. It imports fields exposed by the Engauge member-list API (XP, level, messages, voice seconds, and currency). When Engauge does not expose a separate current-level XP threshold, Avero preserves the reported cumulative XP and level, then starts a fresh local level-progress bar for future XP. Avero's native level-up curve uses 1,000 XP for the first level threshold and increases the next threshold by 1,000 per level; confirm this matches the progression you want before switching members over.

Do not remove the old Engauge data or uninstall Engauge until the imported totals have been checked and you have a database backup. Historical per-message/per-session events cannot be recreated from aggregate member statistics.

## Natural-language prefix and AI assistant

Members can use `avero` as a message prefix as well as the existing slash commands:

- `avero help` — run the regular help command.
- `avero balance` — run the matching Avero command.
- `avero profile @member` — pass command options as positional arguments.
- `avero` followed by a question — ask the Gemini-powered Avero assistant for command guidance.

Prefix commands are routed to the same command implementations as slash commands, with the same server feature switches and command-level permission checks. Arguments are positional; quote multi-word values, for example `avero profile bio "Hello there"`. Commands requiring interactive Discord-only inputs or complex option types may still need their slash-command form.

To enable AI answers, create a Gemini API key in Google AI Studio and set `GEMINI_API_KEY` in the bot's environment (never commit the key). The default model is `gemini-3.1-flash-lite`; `GEMINI_MODEL` can override it. If no key is configured, prefix command execution and `avero help` continue to work, while natural-language questions explain that AI setup is missing.

The assistant receives the member's question and Avero's public command catalogue. Do not send passwords, private member information, or sensitive server data through it. Gemini's free tier may use submitted content to improve Google's products; review Google's current API terms and pricing before enabling it for a public server.

## Included commands

- `/ping` — checks interaction and gateway latency.
- `/help` — groups the available commands by category.
- `/profile [member]` — combines wallet, per-game Arcade Mastery tiers, themed collection progress, and unlocked set titles.
- `/leaderboard [category]` — shows global top coin, combined Games, Coinflip, Guess, Rock-paper-scissors, or Vault rankings. Game boards include wins, losses, ties where applicable, and win rate.
- `/achievements [member]` — tracks twelve global activity, game, coin, and collection milestones. No extra coin rewards are minted.
- `/collections [member]` — view three themed collectible sets (Archive Protocol, Neon Circuit, Moonlit Relics), their matching expedition routes, completion progress, and cosmetic set titles.
- `/balance` — shows your global Avero coin balance.
- `/daily` — claims 100 coins once per 24-hour cooldown.
- `/contracts [claim]` — view four daily goals and claim each completed reward once; progress resets at 00:00 UTC. A new collectible found during `/scavenge` also counts toward the collector goal.
- `/work` — apply for a career, then earn its 70–150 coin salary plus promotions on one shared 60-minute shift cooldown. The `/work shift` command and wallet Work button use the same career system.
- `/scavenge [route]` — choose the Old Server Archive, Neon Plaza, or Moonlit Garden every 20 minutes for 25–55 coins and a route-specific collectible drop; duplicate finds grant a coin bonus. Leave the route blank for a random expedition.
- `/coinflip call` — call heads or tails for a free round; a win can earn 25 coins under the shared 10-minute game-reward cooldown. No wagers or entry fees.
- `/guess number` — guess a number from 1 to 5 to earn 25 coins on a win, with one 25-coin reward every 10 minutes to limit coin farming. Playing is free.
- `/rps choice` — play rock-paper-scissors for free. Wins, losses, and ties are tracked; wins can earn 25 coins, sharing the 10-minute game-reward cooldown with `/guess`, `/coinflip`, and `/vault`. No entry fees or wagers.
- `/vault [code]` — view the daily three-dial clues, then submit your solution. Clues are deterministic for each server and UTC date; each member gets one code submission per UTC day; a correct solve earns one 25-coin Vault reward when the shared 10-minute Guess/RPS/Coinflip cooldown is ready. Free play, no wagers.
- `/games` — open the button-driven quick-play hub for Guess, RPS, Coinflip, and the daily Vault.
- `/shop` — browse six collectible badges and relics with rarity labels and prices.
- `/buy item` — purchase a collectible once; purchases are saved and coins are deducted atomically.
- `/inventory` — browse your server collection with pagination, per-item detail panels, and collection milestones (First Find, Curator, Full Set); unowned collectibles can be unlocked directly from their detail view. Use `/collections` to track themed sets.

Currency is virtual and has no cash value. Each Discord user has one global wallet shared across all servers. Daily claims, work shifts, scavenge rewards, game rewards, and shop purchases use global cooldowns and are recorded in one global transaction ledger. Free games never deduct coins to enter. Shop purchases are virtual collectibles only, cannot be bought twice, and never allow a balance to go negative. Successful game, wallet, shop, and collection responses are public by default; private replies are reserved for invalid contexts and purchase/cooldown feedback.

## Profile customization roadmap

The collectible shop is the foundation for Avero profile customization. Member-owned profile data and equipment are global across servers. Members can equip one owned badge and one owned cosmetic as their profile frame; both selections persist across servers.

- **Profile cards:** evolve the compact `/profile` summary into a shareable card with avatar, coins, selected stats, badges, title, and bio.
- **Customization inventory:** badges and cosmetic profile frames can be bought and equipped independently. Further profile themes, color accents and title styles remain planned.
- **Free and premium-style unlocks:** some options will be free; others can be earned or bought with virtual coins. Any future donor, funder, voter, or server-booster perks should be granted from verified server/platform data, not self-declared text.
- **Rendering:** games and currency panels use a shared canvas-rendered hero graphic. Profile cards can reuse this renderer later; keep the first profile-card version static before considering animated backgrounds.
- **Server boundaries:** member balances, purchases, equipped cosmetics, careers, titles, and progression are global across servers. Guild-specific settings and role configuration remain server-scoped.

Profile frames and badges are global member cosmetics. Open `/inventory`, select an owned badge or cosmetic, then use its Equip action. Only owned items can be equipped; the selected badge and frame are shown on `/profile`. Either selection can be removed from the same item detail panel.

## Persistence

Avero uses PostgreSQL through Prisma. `MemberProfile`, `CurrencyAccount`, `MemberJob`, and `MemberTitle` use a reserved global scope keyed by Discord user ID. `CurrencyAccount` stores the one global wallet and shared cooldown timestamps. `CurrencyTransaction` records the member's global history. `CurrencyPurchase` stores global collectible ownership. `DailyContractClaim` prevents daily contract and Vault rewards from being claimed more than once per member and UTC date. `GuildSettings` and `MoneyRequest` origin metadata remain guild-scoped. Database migrations must be applied explicitly to the intended database; they are not applied automatically.

## Shared AveroUI assets

Reusable visual assets live in one place instead of being scattered through commands:

- `averoui/icons.js` — small text-safe glyphs used in Discord UI.
- `averoui/assets.js` — shared asset catalogue with IDs, intended uses, and source/licence notes for artwork. Import `ASSETS`, `getAsset(id)`, or `listAssets({ kind })`.
- `assets/icons/` — original Avero SVGs for the coin, rarity gems, brand mark, six individually illustrated shop collectibles, and the chibi-professor mascot. Use `loadRegisteredAsset("coin")` or `loadAssetBuffer("icons/coin.svg")` from `averoui/asset-loader.js`; paths are restricted to this folder.
- `averoui/canvas.js` — generated artwork when a panel needs custom Avero-branded art rather than a static image.
- `averoui/render-asset.js` — converts registered SVG files to PNG buffers for Discord attachments.
- Economy UI consumes shared asset-symbol and rarity mappings in wallet, shop, item-detail, and inventory panels.

This is intentionally a version-controlled asset library, not a new database table: static icons and artwork don't need database storage. For downloaded assets, record the source and licence before committing; original AI-generated or canvas-drawn Avero art is usually the simplest way to keep the visual style consistent. No external files are downloaded at runtime.

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

## Advanced autoresponder

Server administrators can create rules with `/autoresponder add`, inspect them with `/autoresponder list` and `/autoresponder logs`, edit/toggle/remove them, and preview responses with `/autoresponder test`. Rules support exact/contains/starts-with/ends-with matching, attachment and mention triggers, text/embed/reply/random/DM responses, placeholders, role/channel allowlists and denylists, priority, server and per-user cooldowns (new rules default to a 2-second server cooldown and 5-second per-user cooldown), stop-after-match, optional response deletion, and recent execution logs.

Enable the **Message Content Intent** for the Avero application in the Discord Developer Portal (Bot → Privileged Gateway Intents). Avero requests this intent at runtime so text triggers can be evaluated. The bot needs **Send Messages** in response channels and **Embed Links** for embed responses. DM responses depend on each member's privacy settings. Configure the feature from `/config` → **Autoresponder**.

Supported placeholders: `{user}`, `{username}`, `{user_id}`, `{server}`, `{server_id}`, `{channel}`, `{member_count}`, `{mention}`, and `{bot}`. Separate random response choices with `||`.



### Message milestones

Use /autoresponder milestones set to configure a celebration response at any 5,000-message step from 5,000 through 100,000. /autoresponder milestones list shows all 20 thresholds; toggle, remove, and test manage each response. Counts are per member per server, persisted in PostgreSQL, and announcements are posted in the channel where the member reaches the threshold with a mention. Supported placeholders: {user}, {mention}, {username}, {user_id}, {server}, {server_id}, {channel}, {count}, and {milestone}. Failed announcements remain pending and are retried on that member's next message.

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
│   │   ├── currency-repository.js
│   │   └── member-repository.js
│   ├── bot/
│   │   ├── commands/
│   │   ├── command-registry.js
│   │   ├── economy-rules.js
│   │   ├── config.js
│   ├── bot.js
│   ├── register-commands.js
│   ├── app.js
│   └── server.js
└── test/
```

RPS is part of the free-play Duel Deck. Daily Contracts, The Vault, Coinflip, route-based expeditions, achievements, and Engauge-backed leveling are implemented. See [the games and currency finish plan](docs/games-currency-roadmap.md) for current scope and remaining work.


## Activity leaderboards

Avero can maintain two persistent server-scoped Components V2 activity boards: daily and weekly. Message activity is counted once per Discord message ID; voice time is settled from persisted sessions while a non-bot member is unmuted and undeafened in a voice channel with the configured minimum number of humans. Voice-state events do not expose actual speaking activity, so this is an eligible-presence measure rather than proof that a member is speaking. The current Engauge server rates are mirrored with **8 XP per message** (one award per member per rolling 60 seconds) and **8 XP per complete eligible voice minute**. XP awards are persisted in an outbox, delivered to Engauge, and never blindly retried after an ambiguous response.

Use **/rank [member]** for an Engauge-backed level card with separate total XP, message count, and voice minutes. The existing **/leaderboard** command also offers Engauge XP, message, voice-time, and currency rankings; these read the full server member list through the paginated API. Configure the boards from /config → **Activity leaderboards**. Set each text-channel ID, weighted message and voice-minute scores, timezone, weekly reset day, voice eligibility, and placement reward rules (daily and weekly positions 1–10). Configuring channels publishes the boards; subsequent updates edit the stored messages every five minutes, and missing messages are recreated. /activity shows a compact private summary.

Reward claims are unique per guild, period, period key, and placement. Coin rewards are credited to the existing global wallet and logged as currency transactions; role delivery is retried when permissions or hierarchy prevent it. XP rewards are sent directly to Engauge through its member lookup and XP-award API, so Engauge remains the source of truth for its configured level formula. Set `ENGAUGE_API_TOKEN` as a secret in the environment that actually runs `npm run bot`; Avero reads it from `process.env` at startup and logs only whether it is present, never the token. A GitHub Actions repository secret is not automatically passed to a separately hosted bot: a workflow must explicitly map it into the process environment, or the bot host must have the secret configured there. The client defaults to `https://engau.ge` and Bearer authorization, with `ENGAUGE_API_BASE_URL`, `ENGAUGE_API_AUTH_HEADER`, and `ENGAUGE_API_AUTH_SCHEME` available for deployments using a different API host or token header format. A documented Engauge HTTP 502 after the XP POST is treated as committed; ambiguous network/5xx outcomes are held for manual verification rather than automatically paid twice. Voice tracking requires the GuildVoiceStates gateway intent. Avero needs View Channel and Send Messages in each configured board channel, and Manage Server to edit activity settings.
