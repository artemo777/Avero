import { Client, GatewayIntentBits } from "discord.js";
import { renderRegisteredAsset } from "../averoui/render-asset.js";

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_TOKEN or DISCORD_GUILD_ID. Set them in your private .env or host environment.");
  process.exit(1);
}

const EMOJI_ASSETS = Object.freeze([
  ["avero_brand", "brand-mark-svg", "AVERO_EMOJI_BRAND_ID"],
  ["avero_coin", "coin", "AVERO_EMOJI_COIN_ID"],
  ["avero_badge", "badge", "AVERO_EMOJI_BADGE_ID"],
  ["avero_sparkle", "reward-sparkle", "AVERO_EMOJI_SPARKLE_ID"],
  ["avero_loader", "loader", "AVERO_EMOJI_LOADER_ID"],
  ["avero_gem_common", "gem-common", "AVERO_EMOJI_GEM_COMMON_ID"],
  ["avero_gem_rare", "gem-rare", "AVERO_EMOJI_GEM_RARE_ID"],
  ["avero_gem_epic", "gem-epic", "AVERO_EMOJI_GEM_EPIC_ID"],
  ["avero_gem_legendary", "gem-legendary", "AVERO_EMOJI_GEM_LEGENDARY_ID"],
  ["avero_neon_badge", "collectible-neon-badge", "AVERO_EMOJI_NEON_BADGE_ID"],
  ["avero_vault_badge", "collectible-vault-badge", "AVERO_EMOJI_VAULT_BADGE_ID"],
  ["avero_starlight_badge", "collectible-starlight-badge", "AVERO_EMOJI_STARLIGHT_BADGE_ID"],
  ["avero_moonlit_token", "collectible-moonlit-token", "AVERO_EMOJI_MOONLIT_TOKEN_ID"],
  ["avero_prism_crown", "collectible-prism-crown", "AVERO_EMOJI_PRISM_CROWN_ID"],
  ["avero_relic", "collectible-avero-relic", "AVERO_EMOJI_RELIC_ID"]
]);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

try {
  await client.login(token);
  const guild = await client.guilds.fetch(guildId);
  const existing = await guild.emojis.fetch();
  const envLines = [];

  for (const [name, assetId, envName] of EMOJI_ASSETS) {
    let emoji = existing.find((entry) => entry.name === name);
    if (!emoji) {
      const png = await renderRegisteredAsset(assetId, 128);
      emoji = await guild.emojis.create({
        attachment: png,
        name,
        reason: "Install the original AveroUI emoji asset pack"
      });
      existing.set(emoji.id, emoji);
      console.log("Uploaded :" + name + ": (" + emoji.id + ")");
    } else {
      console.log("Already exists :" + name + ": (" + emoji.id + "); reusing it.");
    }
    envLines.push(envName + "=" + emoji.id);
  }

  console.log("\nAdd these IDs to the private .env used to run Avero:\n");
  console.log(envLines.join("\n"));
  console.log("\nEmoji upload complete. Restart Avero after adding the IDs.");
} catch (error) {
  console.error("Avero emoji upload failed:", error.message);
  process.exitCode = 1;
} finally {
  client.destroy();
}
