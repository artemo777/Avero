# Avero games and currency finish plan

This roadmap keeps the games and economy focused, polished, and reliable. The currency is virtual, has no cash value, and is isolated per Discord server. Games remain free to play with no wagers.

## Current foundation

Commands already in the feature branch:

- Economy: `/balance`, `/daily`, `/work`, `/scavenge`, `/contracts`
- Games: `/games`, `/guess`, `/rps`, `/coinflip`, `/vault`
- Collectibles: `/shop`, `/buy`, `/inventory`
- Expeditions: `/scavenge route` with Old Server Archive, Neon Plaza, and Moonlit Garden loot pools
- Progress and discovery: `/profile`, `/achievements`, `/collections`, `/leaderboard`, `/help`

Current earning rules:

| Activity | Reward | Cooldown |
| --- | ---: | ---: |
| Daily claim | 100 coins | 24 hours |
| Work shift | 60–120 coins | 30 minutes |
| Scavenge | 25–55 coins, with a collectible drop chance | 10 minutes |
| Correct guess | 25 coins | One reward every 10 minutes |
| Rock, paper, scissors | +25 coins on a win when the shared game-reward cooldown is ready | Free replay; 10-minute shared cooldown with Guess and Vault |
| Coinflip | +25 coins on a win | One reward every 10 minutes, shared with Guess, RPS, and Vault |
| The Vault | +25 coins on a correct daily code | One reward every 10 minutes, shared with Guess, RPS, and Coinflip |

The reward rules live in `src/bot/economy-rules.js`. Balance changes and purchases use the PostgreSQL transaction ledger. Purchases are unique per member and server, and balances cannot go below zero.

## Finish order

### 1. Reliability and release checks

- Keep Node.js 22 and 24 test suites green.
- Run Prisma migrations in CI against a real PostgreSQL service.
- Verify concurrent daily claims, game rewards, duplicate purchases, and different-item purchases cannot double-pay or overspend.
- Finish the live Discord acceptance checklist in Codespaces before calling the feature complete.
- Verify data survives a bot restart and that two servers never share balances or inventory.

### 2. Daily Contracts

Implemented on the feature branch as `/contracts` with four daily goals: complete two work shifts (+80 coins), scavenge three times (+90), play three recorded game rounds (+75), and unlock one collectible (+100) from either the shop or a new scavenging drop. Progress is derived from the server/member transaction ledger for the current UTC day. Each completed contract has a unique per-member/server/day claim record and is credited atomically with a ledger entry. New scavenge drops write a zero-value `scavenge_collectible` ledger event so they count toward the collector goal without changing coin balances. No wagers or entry fees are involved.

### 3. The Vault

Implemented as `/vault` (view clues) and `/vault code` (submit): a server-specific daily three-dial arithmetic puzzle. Clues are stable for the server and UTC date, with one recorded code submission per member per UTC day to prevent replay farming. Wins and losses are recorded in the existing transaction ledger; a correct solution can earn 25 coins under the same atomic 10-minute cooldown as Guess and RPS. It has no entry fee or wager and requires no additional database migration.

### 4. Achievements and titles

Implemented as `/achievements` with server-scoped progress for First Shift, Field Finder, Game Regular, Duelist, First Collectible, Curator, Full Set, Coin Maker, Big Spender, Archive Keeper, Circuit Breaker, and Moonlit Curator. The command can inspect your own or another member’s milestones. Achievements are cosmetic progress only and do not mint extra coins.

### 5. Expand the adventure loop without command sprawl

Implemented: `/scavenge` offers three themed expedition routes (Old Server Archive, Neon Plaza, Moonlit Garden), each with a distinct collectible drop pool. `/collections` adds three matching collectible sets—Archive Protocol, Neon Circuit, and Moonlit Relics—with cosmetic titles for completion. Set progress is derived from owned collectibles, requires no migration, and grants no extra coins. Coin rewards and cooldowns stay identical across routes, so route choice adds collection strategy without creating a pay-to-win advantage or changing the economy.

### 6. Add useful currency sinks

Add optional profile frames, themes, title styles, and color accents to the shop. These are cosmetic only: no pay-to-win boosts, no real-money value, and no paid entry to games.

## Live acceptance checklist

After the branch stack is integrated and the database migrations are applied in a confirmed development/test Codespace:

1. Check `/balance` on a new member and after earning coins.
2. Claim `/daily` twice; the second attempt must not pay.
3. Run `/work` and `/scavenge` twice; each second attempt must respect its cooldown.
4. Try all three scavenge routes and verify each route only awards collectibles from its own loot pool.
5. Play `/guess` from the slash command and the `/games` buttons; confirm the shared 10-minute reward cooldown.
6. Play `/rps` and `/coinflip` from both slash commands and `/games`; confirm wins, losses, ties where applicable, and no entry fees or wagers.
7. Open `/vault`, submit a code, and confirm one attempt per member per UTC day and at most one reward under the shared game cooldown.
8. Open `/contracts`, complete each objective, claim each reward, and verify repeated claims never pay twice.
9. Open `/shop`, inspect an item, buy it, and try buying it again; ownership and balance must remain correct.
10. Open `/inventory`, page through it, equip and unequip a badge, and verify `/profile` shows only the selected badge.
11. Check coin, XP, games, coinflip, guess, RPS, and Vault leaderboards.
12. Restart the bot and verify balances, cooldowns, purchases, and equipped badge persist.
13. Repeat balance and inventory checks in a second server to confirm strict server isolation.

Do not run production migrations, register global commands, deploy, or merge stacked PRs as part of this checklist without the repository owner's explicit go-ahead.
