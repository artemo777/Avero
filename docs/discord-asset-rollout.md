# Avero Discord asset rollout

This manifest keeps the test-server setup aligned with the artwork already checked into `assets/icons/` and the shared Discord emoji catalogue in `averoui/discord-emojis.js`.

## Server identity

| Discord slot | Recommended asset | Purpose |
| --- | --- | --- |
| Server icon | `assets/icons/brand-mark.svg` exported to PNG | Recognizable Avero mark at small sizes |
| Role icon: staff / trusted | `assets/icons/badge.svg` exported to PNG | Shared role-icon visual language |
| Role icon: economy / events | `assets/icons/coin.svg` exported to PNG | Currency and event identity |
| Bot message artwork | `assets/icons/brand-mark.svg`, `reward-sparkle.svg` | Brand accents and reward moments |

Discord's upload UI may require raster files for specific slots. Export SVG artwork to transparent PNG at a high resolution before uploading; preserve the original SVGs in the repository as source assets.

## Custom emoji naming plan

Use these names if the artwork is uploaded as custom server emoji later. Unicode emoji remain the fallback, so the bot still works when custom emoji are unavailable.

| Suggested name | Source artwork |
| --- | --- |
| `avero_brand` | `brand-mark.svg` |
| `avero_coin` | `coin.svg` |
| `avero_badge` | `badge.svg` |
| `avero_sparkle` | `reward-sparkle.svg` |
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

## Rollout checklist

- [ ] Export the server icon and role icons to transparent PNG where required.
- [ ] Upload custom emoji in the Avero test server and record their emoji IDs.
- [ ] Grant the bot only the permissions it needs; add emoji-management permissions only if the bot will upload/manage emoji itself.
- [ ] If custom emoji are used in bot messages, configure IDs in one shared module instead of hardcoding them across commands.
- [ ] Check every icon in both light and dark Discord themes and at small display sizes.
- [ ] Verify the games, wallet, shop, inventory, and profile panels after the bot is restarted.

**Status:** this is a prepared mapping, not a claim that assets have already been uploaded to Discord. Direct server changes still require an authorized Discord session or a configured bot with the necessary permissions.
