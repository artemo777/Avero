# Avero Discord asset rollout

This pack contains original Avero SVG artwork in `assets/icons/` and the shared emoji catalogue in `averoui/discord-emojis.js`.

## What is included

- Brand mark, coin, badge, sparkle, and loader
- Common, rare, epic, and legendary gems
- Six collectible icons: neon badge, vault badge, starlight badge, moonlit token, prism crown, and Avero relic
- Shared UI emoji mappings for games, shop, inventory, wallet, work, scavenge, daily rewards, and navigation

## Upload the original art as server emoji

The repository includes an idempotent uploader. It converts the registered SVG assets to 128px PNG images, uploads custom emoji to the configured Discord server, reuses emoji already present by name, and automatically writes the resulting IDs to the local `.env` file with owner-only file permissions. It never writes the bot token itself.

1. Set `DISCORD_TOKEN` and `DISCORD_GUILD_ID` in your private local `.env` or hosting environment.
2. Ensure the bot has **Create Expressions** to upload emoji. This is distinct from Manage Expressions, which covers editing and deleting existing expressions.
3. From the repository root, run:

   ```sh
   npm install
   npm run discord:upload-emojis
   ```

4. The uploader saves `AVERO_EMOJI_*_ID` entries to `.env` automatically. If your bot runs on a separate host, set `AVERO_EMOJI_ENV_PATH` to the private env file used by that host, or use the printed IDs to update the host's secret/environment settings.
5. Restart Avero. Guild-aware UI paths can use custom emoji in the configured source guild; other guilds and unset IDs receive portable Unicode fallbacks. Custom emoji IDs must not be sent to guilds that lack access.

Never paste the bot token into chat or commit a `.env` file. If an upload fails, check that the bot is installed in the target server, the guild ID is correct, it has Create Expressions, and the server has available emoji slots.

## Server identity assets

| Discord slot | Recommended asset | Notes |
| --- | --- | --- |
| Server icon | `assets/icons/brand-mark.svg` exported to PNG | Upload manually in Server Settings |
| Role icon: staff / trusted | `assets/icons/badge.svg` exported to PNG | Requires server role-icon support and appropriate role permissions |
| Role icon: economy / events | `assets/icons/coin.svg` exported to PNG | Upload manually in role settings |
| Bot message artwork | `assets/icons/brand-mark.svg`, `reward-sparkle.svg` | Used as source artwork for panels |

Server icon and role icon changes remain manual in Discord settings; the uploader handles custom emoji only.

## Custom emoji manifest

| Emoji name | Source asset |
| --- | --- |
| `avero_brand` | `brand-mark.svg` |
| `avero_coin` | `coin.svg` |
| `avero_badge` | `badge.svg` |
| `avero_sparkle` | `reward-sparkle.svg` |
| `avero_loader` | `loader.svg` |
| `avero_gem_common` | `gem-common.svg` |
| `avero_gem_rare` | `gem-rare.svg` |
| `avero_gem_epic` | `gem-epic.svg` |
| `avero_gem_legendary` | `gem-legendary.svg` |
| `avero_neon_badge` | `collectible-neon-badge.svg` |
| `avero_vault_badge` | `collectible-vault-badge.svg` |
| `avero_starlight_badge` | `collectible-starlight-badge.svg` |
| `avero_moonlit_token` | `collectible-moonlit-token.svg` |
| `avero_prism_crown` | `collectible-prism-crown.svg` |
| `avero_relic` | `collectible-avero-relic.svg` |
