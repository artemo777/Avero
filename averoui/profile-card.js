import { createCanvas, loadImage } from "@napi-rs/canvas";

const WIDTH = 1200;
const HEIGHT = 620;
const BANNERS = Object.freeze({
  midnight: ["#10131d", "#252b3b", "#151b2b"],
  aurora: ["#102b35", "#244b52", "#182b3b"],
  sunset: ["#38202b", "#653d45", "#28233b"],
  forest: ["#142c27", "#29473a", "#172a2b"],
  ocean: ["#10283b", "#214a68", "#17283d"],
  graphite: ["#17191d", "#30343a", "#1d2026"]
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
  level = 0,
  title = null,
  bio = null,
  accentColor = 0x8b7cff,
  banner = "midnight",
  frame = null,
  avatarDecoration = null,
  badges = [],
  coins = 0,
  collectionCount = 0
} = {}) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const colors = BANNERS[banner] ?? BANNERS.midnight;
  const accent = colorHex(accentColor);
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, colors[0]);
  bg.addColorStop(0.55, colors[1]);
  bg.addColorStop(1, colors[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

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
    comet_trail: "#ffad82", mossy_mug: "#9bd29c", paper_crown: "#e8d7a6"
  };
  ctx.strokeStyle = frame ? (frameColors[frame] ?? accent) : accent;
  ctx.lineWidth = frame ? 13 : 7;
  ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR + 8, 0, Math.PI * 2); ctx.stroke();
  if (frame) {
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR + 20, 0, Math.PI * 2); ctx.stroke();
    if (frame === "pixel_cape" || frame === "paper_crown") {
      ctx.fillStyle = frameColors[frame];
      for (const [dx, dy] of [[-120, -42], [120, -42], [-112, 54], [112, 54]]) {
        ctx.fillRect(avatarX + dx - 5, avatarY + dy - 5, 10, 10);
      }
    } else if (frame === "nebula_cape" || frame === "comet_trail") {
      ctx.strokeStyle = frameColors[frame];
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(avatarX, avatarY, 126, 48, -0.42, 0, Math.PI * 2); ctx.stroke();
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
  ctx.fillText("LEVEL " + Math.max(0, Number(level) || 0), textX + 2, 264);

  if (title) {
    ctx.fillStyle = accent;
    ctx.font = "700 21px sans-serif";
    ctx.fillText(String(title).slice(0, 46), textX + 2, 310);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "500 19px sans-serif";
    ctx.fillText("No title equipped", textX + 2, 310);
  }

  if (bio) {
    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.font = "500 18px sans-serif";
    const safeBio = String(bio).replaceAll(String.fromCharCode(10), " ").replaceAll(String.fromCharCode(13), " ").slice(0, 100);
    ctx.fillText(safeBio, textX + 2, 350, 760);
  }

  const statY = 410;
  drawPill(ctx, textX, statY, Number(coins).toLocaleString("en-US") + " COINS", accent, 190);
  drawPill(ctx, textX + 206, statY, String(collectionCount) + " COLLECTIBLES", accent, 220);

  ctx.fillStyle = "#f1f3f8";
  ctx.font = "700 18px sans-serif";
  ctx.fillText("BADGE SHOWCASE", 68, 505);
  const visibleBadges = badges.slice(0, 5);
  if (!visibleBadges.length) {
    ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.font = "500 17px sans-serif";
    ctx.fillText("No badges showcased yet", 68, 548);
  } else {
    visibleBadges.forEach((badge, index) => {
      const x = 68 + index * 214;
      rounded(ctx, x, 520, 198, 54, 15);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.13)";
      ctx.stroke();
      ctx.font = "600 16px sans-serif";
      ctx.fillStyle = "#f5f6fa";
      ctx.textBaseline = "middle";
      ctx.fillText(String(badge.icon ?? "✦") + "  " + String(badge.name).slice(0, 18), x + 14, 547, 170);
    });
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.36)";
  ctx.font = "600 14px sans-serif";
  ctx.fillText("PLAY  /  EARN  /  COLLECT", WIDTH - 66, HEIGHT - 44);
  return canvas.toBuffer("image/png");
}

export const PROFILE_BANNERS = Object.freeze(Object.keys(BANNERS));
