import { createCanvas, loadImage } from "@napi-rs/canvas";

const WIDTH = 1200;
const HEIGHT = 420;
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const format = (value) => Math.floor(clamp(value, 0, Number.MAX_SAFE_INTEGER)).toLocaleString("en-US");

export async function renderRankCard({
  username = "Avero member",
  avatarUrl = null,
  level = 0,
  xp = 0,
  nextLevelXp = 0,
  progressPercent = 0,
  messages = 0,
  voiceMinutes = 0,
  accentColor = 0x65a9ff
} = {}) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const accent = "#" + Math.floor(clamp(accentColor, 0, 0xffffff)).toString(16).padStart(6, "0");
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, "#0b1020");
  bg.addColorStop(0.55, "#17243d");
  bg.addColorStop(1, "#101722");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(1080, 20, 250, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.1;
  ctx.beginPath(); ctx.arc(880, 430, 280, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(18, 18, WIDTH - 36, HEIGHT - 36, 30);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = "700 17px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("AVERO  /  MEMBER RANK", 62, 64);

  const avatarX = 160, avatarY = 210, avatarR = 86;
  ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR + 12, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fill();
  ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR + 7, 0, Math.PI * 2);
  ctx.strokeStyle = accent; ctx.lineWidth = 7; ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2); ctx.clip();
  try {
    if (!avatarUrl) throw new Error("No avatar URL");
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
  } catch {
    ctx.fillStyle = "#30394c";
    ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    ctx.fillStyle = "#fff"; ctx.font = "700 68px sans-serif"; ctx.textAlign = "center";
    ctx.textBaseline = "middle"; ctx.fillText(String(username).slice(0, 1).toUpperCase(), avatarX, avatarY);
  }
  ctx.restore();

  const name = String(username).slice(0, 42);
  ctx.fillStyle = "#f7f8fc";
  let nameSize = 54;
  ctx.font = "700 " + nameSize + "px sans-serif";
  while (ctx.measureText(name).width > 800 && nameSize > 28) {
    nameSize -= 2;
    ctx.font = "700 " + nameSize + "px sans-serif";
  }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(name, 300, 178, 820);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "500 23px sans-serif";
  ctx.fillText("LEVEL  " + format(level), 302, 220);
  ctx.fillStyle = "#f5f7fc";
  ctx.font = "700 19px sans-serif";
  ctx.fillText(format(xp) + " XP", 302, 264);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 17px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(nextLevelXp > 0 ? format(nextLevelXp) + " XP TO NEXT LEVEL" : "MAX LEVEL", 1115, 264);

  const barX = 302, barY = 284, barW = 810, barH = 18;
  ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 9);
  ctx.fillStyle = "rgba(255,255,255,0.13)"; ctx.fill();
  const progress = clamp(progressPercent, 0, 100) / 100;
  if (progress > 0) {
    ctx.beginPath(); ctx.roundRect(barX, barY, Math.max(18, barW * progress), barH, 9);
    ctx.fillStyle = accent; ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "600 15px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(format(messages) + " MESSAGES", 302, 348);
  ctx.fillText(format(voiceMinutes) + " VOICE MIN", 535, 348);
  ctx.textAlign = "right";
  ctx.fillText(Math.round(progress * 100) + "% PROGRESS", 1115, 348);

  return canvas.toBuffer("image/png");
}
