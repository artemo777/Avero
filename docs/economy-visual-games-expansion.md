# Economy and visual-games expansion

This plan extends the existing economy; it does not replace the global member wallet,
ledger, collections, achievements, contracts, work, shop, or shared game reward cooldown.

## Session validation core
- Added `src/bot/game-session-core.js` with owner binding, age validation, completion/replay guard and safe input checks.
- Added Node tests for fresh, wrong-owner, expired, completed and malformed-timing scenarios.
- This helper is pure and is not a substitute for persisted session records, database uniqueness, or transactional reward claims.

## Reliability gates
- All coin and gem writes must go through existing transactional repository methods.
- A game session must be persisted before the player can interact with a reward path.
- Component IDs must bind to the player and session; expired/replayed actions must be rejected.
- Reward claim must be idempotent and transactionally recorded.
- Game components must obey server game/currency settings.
- Avoid migrations until an existing ledger/session model cannot support the feature.
- Validate commands and component handling with syntax checks, unit tests, and Discord acceptance tests.

## Expansion ideas
1. **Fishing timing game**: skill-based timing challenge, fish journal, cosmetic rods and regions.
   Core scoring lives in `src/bot/fishing-core.js`; this module intentionally does not issue currency.
   Reward integration requires session persistence and an idempotent claim path.
2. **Mine grid**: a small visual board with deterministic server-side board state, limited turns,
   tool cosmetics and ore journal.
3. **Tower**: branching puzzles and non-combat challenge floors, checkpoint records and cosmetic badges.
4. **Reaction arena**: server-side timing windows, anti-replay session IDs, accuracy records.
5. **Farm**: timestamp-based crop growth, inventory-based seed ownership and atomic harvest.
6. **Daily/weekly quest rotation**: goals derived from ledger events; claims protected by unique records.
7. **Dashboard**: one wallet/profile/game launcher using Discord component layouts.

## Economy balance
- No entry fees, wagers or gambling-like reward loops.
- Use modest, capped rewards; keep cosmetics and achievements as the primary long-term unlocks.
- Prefer skill-based rewards and server-defined caps.
- Audit every currency transaction and keep balance snapshots derived from the authoritative database.

## Release sequence
1. Review existing ledger, sessions, command routing and feature toggles.
2. Integrate and persist Fishing sessions and claims.
3. Add tests for duplicate button clicks, expired sessions, user-bound IDs, cooldowns and restart persistence.
4. Build Mine Grid and Reaction Arena.
5. Build Tower and Farm after their persistence model and reward balance are reviewed.
6. Run `npm run verify`, migrations (if any), and a live Discord acceptance checklist before deployment.
