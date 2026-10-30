# Avero games and currency finish plan

This roadmap keeps the games and economy focused, polished, and reliable. The currency is virtual, has no cash value, and is isolated per Discord server. Games remain free to play with no wagers.

## Current foundation

Commands already in the feature branch:

- Economy: `/balance`, `/daily`, `/work`, `/scavenge`
- Games: `/games`, `/guess`, `/rps`
- Collectibles: `/shop`, `/buy`, `/inventory`
- Progress and discovery: `/profile`, `/leaderboard`, `/help`

Current earning rules:

| Activity | Reward | Cooldown |
| --- | ---: | ---: |
| Daily claim | 100 coins | 24 hours |
| Work shift | 60–120 coins | 30 minutes |
| Scavenge | 25–55 coins, with a collectible drop chance | 10 minutes |
| Correct guess | 25 coins | One reward every 10 minutes |
| Rock, paper, scissors | +25 coins on a win when the shared game-reward cooldown is ready | Free replay; 10-minute shared cooldown with Guess |

The reward rules live in `src/bot/economy-rules.js`. Balance changes and purchases use the PostgreSQL transaction ledger. Purchases are unique per member and server, and balances cannot go below zero.

## Finish order

### 1. Reliability and release checks

- Keep Node.js 22 and 24 test suites green.
- Run Prisma migrations in CI against a real PostgreSQL service.
- Verify concurrent daily claims, game rewards, duplicate purchases, and different-item purchases cannot double-pay or overspend.
- Finish the live Discord acceptance checklist in Codespaces before calling the feature complete.
- Verify data survives a bot restart and that two servers never share balances or inventory.

### 2. Daily Contracts

Implemented on the feature branch as `/contracts` with four daily goals: complete two work shifts (+80 coins), scavenge three times (+90), play three recorded game rounds (+75), and unlock one collectible (+100). Progress is derived from the server/member transaction ledger for the current UTC day. Each completed contract has a unique per-member/server/day claim record and is credited atomically with a ledger entry. No wagers or entry fees are involved.

### 3. The Vault

Proposed command: `/vault`

A short code-breaking or logic puzzle with a clear success/failure result. It has no entry fee or wager. A fixed reward uses a persistent cooldown and a one-use challenge record so retries, stale buttons, or concurrent clicks cannot duplicate rewards.

### 4. Achievements and titles

Implemented as `/achievements` with server-scoped progress for First Shift, Field Finder, Game Regular, Duelist, First Collectible, Curator, Full Set, Coin Maker, and Big Spender. The command can inspect your own or another member’s milestones. Achievements are cosmetic progress only and do not mint extra coins.

### 5. Expand the adventure loop without command sprawl

Improve `/scavenge` into a short Expedition/Loot Run with a few themed choices and occasional collectible discoveries. Prefer extending the existing command over adding several near-duplicate commands.

### 6. Add useful currency sinks

Add optional profile frames, themes, title styles, and color accents to the shop. These are cosmetic only: no pay-to-win boosts, no real-money value, and no paid entry to games.

## Live acceptance checklist

After the branch stack is integrated and the database migrations are applied in the Codespace:

1. Check `/balance` on a new member and after earning coins.
2. Claim `/daily` twice; the second attempt must not pay.
3. Run `/work` and `/scavenge` twice; each second attempt must respect its cooldown.
4. Play `/guess` from the slash command and the `/games` buttons; confirm the 10-minute reward limit is shared.
5. Play `/rps`; confirm every result is recorded, wins can earn +25 only when the shared 10-minute Guess/RPS reward cooldown is ready, and no game has an entry fee or wager.
6. Open `/shop`, inspect an item, buy it, and try buying it again; ownership and balance must remain correct.
7. Open `/inventory`, page through it, equip and unequip a badge, and verify `/profile` shows only the selected badge.
8. Check coin, XP, games, guess, and RPS leaderboards.
9. Restart the bot and verify balances, cooldowns, purchases, and equipped badge persist.
10. Repeat balance and inventory checks in the second server to confirm strict server isolation.

Do not run production migrations, register global commands, deploy, or merge stacked PRs as part of this checklist without the repository owner's explicit go-ahead.
