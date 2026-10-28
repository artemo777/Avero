import { createCanvas } from "@napi-rs/canvas";

const WIDTH = 1200;
const HEIGHT = 440;

function hexColor(value) {
  return "#" + Math.max(0, Number(value) || 0).toString(16).padStart(6, "0").slice(-6);
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

export function renderAveroCanvas({ eyebrow = "GAMES & COINS", title = "Avero", accentColor = 0x8B7CFF } = {}) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const accent = hexColor(accentColor);
  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, "#11131e");
  background.addColorStop(0.58, "#202438");
  background.addColorStop(1, "#151b2b");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(1010, 115, 240, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.arc(1090, 365, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  roundedRect(ctx, 22, 22, WIDTH - 44, HEIGHT - 44, 30);
  ctx.stroke();

  const markGradient = ctx.createLinearGradient(64, 70, 170, 176);
  markGradient.addColorStop(0, accent);
  markGradient.addColorStop(1, "#27C7B7");
  ctx.fillStyle = markGradient;
  roundedRect(ctx, 72, 80, 100, 100, 28);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 54px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", 122, 130);

  // Draw the shared Avero coin motif into every generated panel.
  const coinX = WIDTH - 160;
  const coinY = 170;
  const coinGradient = ctx.createLinearGradient(coinX - 45, coinY - 45, coinX + 45, coinY + 45);
  coinGradient.addColorStop(0, "#fff0a6");
  coinGradient.addColorStop(0.5, "#ffbf45");
  coinGradient.addColorStop(1, "#d87516");
  ctx.save();
  ctx.shadowColor = "rgba(255,191,69,0.35)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = coinGradient;
  ctx.beginPath();
  ctx.arc(coinX, coinY, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#fff0b5";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = "#7c4619";
  ctx.font = "700 54px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", coinX, coinY + 1);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = "700 22px sans-serif";
  ctx.fillText(String(eyebrow).toUpperCase().slice(0, 48), 202, 106);

  ctx.fillStyle = "#f7f8ff";
  ctx.font = "700 56px sans-serif";
  const safeTitle = String(title).slice(0, 34);
  ctx.fillText(safeTitle, 198, 184, 850);

  ctx.fillStyle = "rgba(247,248,255,0.62)";
  ctx.font = "500 20px sans-serif";
  ctx.fillText("PLAY  /  EARN  /  COLLECT", 202, 232);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundedRect(ctx, 202, 272, 280, 5, 3);
  ctx.fill();
  ctx.fillStyle = accent;
  roundedRect(ctx, 202, 272, 112, 5, 3);
  ctx.fill();

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "600 16px sans-serif";
  ctx.fillText("AVERO  •  DISCORD", WIDTH - 70, HEIGHT - 58);

  return canvas.toBuffer("image/png");
}
