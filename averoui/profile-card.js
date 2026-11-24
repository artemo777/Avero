import { createCanvas, loadImage } from "@napi-rs/canvas";
import * as gifencModule from "gifenc";

const gifenc = gifencModule.default ?? gifencModule;
const GIFEncoder = gifencModule.GIFEncoder ?? gifenc.GIFEncoder;
const quantize = gifencModule.quantize ?? gifenc.quantize;
const applyPalette = gifencModule.applyPalette ?? gifenc.applyPalette;

const WIDTH = 1200;
const HEIGHT = 620;
const BANNERS = Object.freeze({
  midnight: ["#10131d", "#252b3b", "#151b2b"],
  aurora: ["#102b35", "#244b52", "#182b3b"],
  sunset: ["#38202b", "#653d45", "#28233b"],
  forest: ["#142c27", "#29473a", "#172a2b"],
  ocean: ["#10283b", "#214a68", "#17283d"],
  graphite: ["#17191d", "#30343a", "#1d2026"],
  cobalt: ["#0b1d38", "#174a7a", "#101a32"],
  rose: ["#321d30", "#653a59", "#211b32"],
  ember: ["#351c19", "#75402b", "#211b25"],
  frost: ["#172a3b", "#46677d", "#202a3b"]
});

function colorHex(value) {
  return "#" + Math.max(0, Math.min(0xffffff, Number(value) || 0x8b7cff)).toString(16).padStart(6, "0");
}
function rounded(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
function fitText(ctx, value, maxWidth, startSize, weight = 700) {
  let size = startSize;
  while (size > 16) {
    ctx.font = weight + " " + size + "px sans-serif";
    if (ctx.measureText(value).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}
function drawPill(ctx, x, y, label, accent, width) {
  rounded(ctx, x, y, width, 42, 14);
  ctx.fillStyle = "rgba(255,255,255,0.075)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = "700 16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + width / 2, y + 21, width - 16);
}

export async function renderProfileCard({
  username = "Avero member",
  avatarUrl,
  title = null,
  bio = null,
  accentColor = 0x8b7cff,
  banner = "midnight",
  bannerImage = null,
  frame = null,
  avatarDecoration = null,
  badges = [],
  coins = 0,
  collectionCount = 0,
  gamesPlayed = 0,
  dailyStreak = 0
} = {}) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const colors = BANNERS[banner] ?? BANNERS.midnight;
  const accent = colorHex(accentColor);
  let customBanner = false;
  if (bannerImage) {
    try {
      const image = await loadImage(Buffer.from(bannerImage));
      if (image.width > 0 && image.height > 0 && image.width <= 4096 && image.height <= 4096) {
        const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
        const sourceWidth = WIDTH / scale;
        const sourceHeight = HEIGHT / scale;
        ctx.drawImage(image, (image.width - sourceWidth) / 2, (image.height - sourceHeight) / 2,
          sourceWidth, sourceHeight, 0, 0, WIDTH, HEIGHT);
        customBanner = true;
      }
    } catch {
      customBanner = false;
    }
  }
  if (!customBanner) {
    const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, colors[0]);
    bg.addColorStop(0.55, colors[1]);
    bg.addColorStop(1, colors[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else {
    ctx.fillStyle = "rgba(7,10,16,0.48)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(1030, 90, 260, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.10;
  ctx.beginPath(); ctx.arc(850, 500, 310, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  rounded(ctx, 18, 18, WIDTH - 36, HEIGHT - 36, 34);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subtle editorial grid and accent glow details.
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let x = 88; x < WIDTH - 80; x += 48) { ctx.beginPath(); ctx.moveTo(x, 96); ctx.lineTo(x, HEIGHT - 72); ctx.stroke(); }
  for (let y = 112; y < HEIGHT - 72; y += 48) { ctx.beginPath(); ctx.moveTo(72, y); ctx.lineTo(WIDTH - 72, y); ctx.stroke(); }
  ctx.restore();

  ctx.fillStyle = accent;
  ctx.font = "700 17px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("AVERO  /  MEMBER PROFILE", 68, 76);

  const avatarX = 170, avatarY = 255, avatarR = 94;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "rgba(8,10,16,0.8)";
  ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR + 12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  const frameColors = {
    aurora_frame: "#70e4d0", nebula_cape: "#bd9cff", moonlit_token: "#9bd5ff",
    prism_crown: "#f3d477", pixel_cape: "#a8b7ff", cloud_specs: "#d5e8ff",
    comet_trail: "#ffad82", mossy_mug: "#9bd29c", paper_crown: "#e8d7a6",
    blueprint_frame: "#74baff", mono_frame: "#aeb5c0", chibi_frame: "#78b8ff",
    cobalt_frame: "#4c9dff", frost_frame: "#b7e4ff", ember_frame: "#ff986c", starlight_frame: "#b8a7ff"
  };
  ctx.strokeStyle = frame ? (frameColors[frame] ?? accent) : accent;
  ctx.lineWidth = frame ? 13 : 7;
  ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR + 8, 0, Math.PI * 2); ctx.stroke();
  if (frame) {
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR + 20, 0, Math.PI * 2); ctx.stroke();
    if (frame === "pixel_cape" || frame === "paper_crown" || frame === "mono_frame" || frame === "blueprint_frame") {
      ctx.fillStyle = frameColors[frame];
      for (const [dx, dy] of [[-120, -42], [120, -42], [-112, 54], [112, 54]]) {
        ctx.fillRect(avatarX + dx - 5, avatarY + dy - 5, 10, 10);
      }
    } else if (frame === "nebula_cape" || frame === "comet_trail" || frame === "cobalt_frame" || frame === "starlight_frame" || frame === "frost_frame") {
      ctx.strokeStyle = frameColors[frame];
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(avatarX, avatarY, 126, 48, -0.42, 0, Math.PI * 2); ctx.stroke();
      if (frame === "starlight_frame" || frame === "cobalt_frame") {
        for (const [dx, dy] of [[-118, -44], [118, -44], [-118, 44], [118, 44]]) {
          ctx.beginPath(); ctx.arc(avatarX + dx, avatarY + dy, 5, 0, Math.PI * 2); ctx.fill();
        }
      }
    } else if (frame === "ember_frame" || frame === "chibi_frame") {
      ctx.fillStyle = frameColors[frame];
      for (const [dx, dy] of [[-120, -72], [120, -72], [-120, 72], [120, 72]]) {
        ctx.beginPath(); ctx.arc(avatarX + dx, avatarY + dy, frame === "chibi_frame" ? 7 : 5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  ctx.save();
  ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2); ctx.clip();
  try {
    if (avatarUrl) {
      const avatar = await loadImage(avatarUrl);
      ctx.drawImage(avatar, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    } else throw new Error("No avatar URL");
  } catch {
    ctx.fillStyle = "#343a49";
    ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 70px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(username).slice(0, 1).toUpperCase(), avatarX, avatarY);
  }
  ctx.restore();

  if (avatarDecoration) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 5;
    if (avatarDecoration === "halo_ring") {
      ctx.beginPath(); ctx.ellipse(avatarX, avatarY - 112, 58, 16, -0.12, 0, Math.PI * 2); ctx.stroke();
    } else if (avatarDecoration === "orbit_spark") {
      for (const [dx, dy] of [[-116, -58], [112, -74], [104, 74], [-108, 82]]) {
        ctx.beginPath(); ctx.arc(avatarX + dx, avatarY + dy, 7, 0, Math.PI * 2); ctx.fill();
      }
    } else if (avatarDecoration === "pixel_wings") {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.9 - i * 0.2;
          ctx.fillRect(avatarX + side * (106 + i * 12), avatarY - 26 + i * 28, 12, 12);
        }
      }
    }
    ctx.restore();
  }

  const textX = 330;
  ctx.fillStyle = "#f7f8fc";
  const safeName = String(username).slice(0, 48);
  ctx.font = "700 " + fitText(ctx, safeName, 760, 58) + "px sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(safeName, textX, 220, 760);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "500 23px sans-serif";
  ctx.fillText(title ? String(title).slice(0, 46) : "No title equipped", textX + 2, 264);


  if (bio) {
    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.font = "500 18px sans-serif";
    const safeBio = String(bio).replaceAll(String.fromCharCode(10), " ").replaceAll(String.fromCharCode(13), " ").slice(0, 100);
    ctx.fillText(safeBio, textX + 2, 350, 760);
  }

  // Compact premium stat tiles with clear hierarchy.
  const statY = 402;
  const statItems = [
    { label: "COINS", value: Number(coins).toLocaleString("en-US"), icon: "◆" },
    { label: "COLLECTIBLES", value: String(collectionCount), icon: "✦" },
    { label: "GAMES PLAYED", value: Number(gamesPlayed).toLocaleString("en-US"), icon: "◈" },
    { label: "DAILY STREAK", value: String(dailyStreak) + " days", icon: "↗" }
  ];
  statItems.forEach((item, index) => {
    const x = textX + index * 202;
    rounded(ctx, x, statY, 184, 76, 18);
    ctx.fillStyle = "rgba(9,12,20,0.48)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.11)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = "700 19px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(item.icon, x + 16, statY + 25);
    ctx.fillStyle = "rgba(255,255,255,0.52)";
    ctx.font = "700 12px sans-serif";
    ctx.fillText(item.label, x + 44, statY + 25);
    ctx.fillStyle = "#f7f8fc";
    ctx.font = "700 23px sans-serif";
    ctx.fillText(item.value, x + 16, statY + 54, 152);
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 15px sans-serif";
  ctx.fillText("BADGE SHOWCASE", 68, 505);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(68, 514, WIDTH - 136, 1);
  const visibleBadges = badges.slice(0, 5);
  if (!visibleBadges.length) {
    ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.font = "500 17px sans-serif";
    ctx.fillText("No badges showcased yet", 68, 548);
  } else {
    visibleBadges.forEach((badge, index) => {
      const x = 68 + index * 214;
      rounded(ctx, x, 526, 198, 52, 14);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.13)";
      ctx.stroke();
      ctx.font = "600 16px sans-serif";
      ctx.fillStyle = accent;
      ctx.textBaseline = "middle";
      ctx.fillText(String(badge.icon ?? "✦"), x + 14, 552);
      ctx.fillStyle = "#f5f6fa";
      ctx.fillText(String(badge.name).slice(0, 18), x + 42, 552, 140);
    });
  }

  // Profile frames now wrap the full card, not the avatar ring.
  if (frame) {
    const frameColor = frameColors[frame] ?? accent;
    ctx.save();
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 8;
    rounded(ctx, 24, 24, WIDTH - 48, HEIGHT - 48, 30);
    ctx.stroke();
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    rounded(ctx, 38, 38, WIDTH - 76, HEIGHT - 76, 24);
    ctx.stroke();
    ctx.restore();
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.36)";
  ctx.font = "600 14px sans-serif";
  ctx.fillText("PLAY  /  EARN  /  COLLECT", WIDTH - 66, HEIGHT - 44);
  return canvas.toBuffer("image/png");
}

export const PROFILE_BANNERS = Object.freeze(Object.keys(BANNERS));


export async function renderAnimatedProfileCard(options = {}) {
  const base = await renderProfileCard(options);
  const image = await loadImage(base);
  const frameId = options.frame ?? "starlight_frame";
  const colorMap = { aurora_frame: "#70e4d0", nebula_cape: "#bd9cff", cobalt_frame: "#4c9dff", frost_frame: "#b7e4ff", ember_frame: "#ff986c", starlight_frame: "#b8a7ff", blueprint_frame: "#74baff", mono_frame: "#aeb5c0", chibi_frame: "#78b8ff", pixel_cape: "#a8b7ff", paper_crown: "#e8d7a6", comet_trail: "#ffad82", mossy_mug: "#9bd29c", cloud_specs: "#d5e8ff", moonlit_token: "#9bd5ff", prism_crown: "#f3d477" };
  const accent = colorMap[frameId] ?? colorHex(options.accentColor);
  const encoder = GIFEncoder();
  const frames = 8;
  const gifWidth = 600, gifHeight = 310;
  for (let frameIndex = 0; frameIndex < frames; frameIndex++) {
    const canvas = createCanvas(gifWidth, gifHeight);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, gifWidth, gifHeight);
    const phase = frameIndex / frames * Math.PI * 2;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.4 + 0.45 * ((Math.sin(phase) + 1) / 2);
    ctx.lineWidth = 3;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    rounded(ctx, 12, 12, gifWidth - 24, gifHeight - 24, 15);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = accent;
    if (["nebula_cape","comet_trail","cobalt_frame","starlight_frame","frost_frame"].includes(frameId)) {
      ctx.save(); ctx.globalAlpha = 0.65;
      ctx.beginPath(); ctx.ellipse(gifWidth / 2, gifHeight / 2, 210 + Math.sin(phase) * 12, 110 + Math.cos(phase) * 8, phase * 0.3, 0, Math.PI * 2); ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    } else if (["pixel_cape","paper_crown","mono_frame","blueprint_frame"].includes(frameId)) {
      for (let p = 0; p < 12; p++) { const px = 24 + ((p * 47 + frameIndex * 11) % (gifWidth - 48)); const py = 24 + ((p * 29 + frameIndex * 7) % (gifHeight - 48)); ctx.globalAlpha = 0.6; ctx.fillRect(px, py, 5, 5); }
    } else if (["ember_frame","chibi_frame","mossy_mug"].includes(frameId)) {
      for (let p = 0; p < 8; p++) { const px = 28 + ((p * 71 + frameIndex * 13) % (gifWidth - 56)); const py = 28 + ((p * 37 + frameIndex * 9) % (gifHeight - 56)); ctx.globalAlpha = 0.5 + Math.abs(Math.sin(phase + p)) * 0.4; ctx.beginPath(); ctx.arc(px, py, 3 + p % 3, 0, Math.PI * 2); ctx.fill(); }
    }
    for (let i = 0; i < 6; i++) {
      const t = (i / 6 + frameIndex / frames) % 1;
      let x, y;
      if (t < 0.25) { x = 21 + (gifWidth - 42) * (t * 4); y = 21; }
      else if (t < 0.5) { x = gifWidth - 21; y = 21 + (gifHeight - 42) * ((t - 0.25) * 4); }
      else if (t < 0.75) { x = gifWidth - 21 - (gifWidth - 42) * ((t - 0.5) * 4); y = gifHeight - 21; }
      else { x = 21; y = gifHeight - 21 - (gifHeight - 42) * ((t - 0.75) * 4); }
      ctx.globalAlpha = 0.45 + 0.55 * ((Math.sin(phase + i) + 1) / 2);
      ctx.beginPath(); ctx.arc(x, y, 2 + (i % 2), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const pixels = ctx.getImageData(0, 0, gifWidth, gifHeight).data;
    const palette = quantize(pixels, 128);
    const indexed = applyPalette(pixels, palette);
    encoder.writeFrame(indexed, gifWidth, gifHeight, { palette, delay: 125, repeat: 0 });
  }
  encoder.finish();
  return Buffer.from(encoder.bytes());
}
