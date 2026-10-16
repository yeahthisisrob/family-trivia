/**
 * Drawing the night sky on a canvas: a fixed field of faint stars, soft
 * colored nebulae that make territories, glowing stars for people, and
 * labels that make room for each other. Plain canvas, no React.
 */

export interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
}

/** mulberry32: a small seeded random, so the sky is the same every visit. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The same faint stars every time, spread over the map and beyond it. */
export function starfield(count: number, w: number, h: number, seed = 7): Star[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    x: (rand() - 0.5) * w,
    y: (rand() - 0.5) * h,
    r: 0.4 + rand() ** 3 * 1.6,
    a: 0.1 + rand() * 0.45,
  }));
}

export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  color: string,
  scale: number,
) {
  ctx.save();
  ctx.fillStyle = color;
  for (const s of stars) {
    ctx.globalAlpha = s.a;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r / Math.sqrt(scale), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** `rgba()` of a #rrggbb color. */
export function tint(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Soft light, added together where it overlaps: many small glows of one
 * color become a territory with an organic edge.
 */
export function drawNebula(
  ctx: CanvasRenderingContext2D,
  glows: { x: number; y: number; r: number; color: string; a: number }[],
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const g of glows) {
    const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    grad.addColorStop(0, tint(g.color, g.a));
    grad.addColorStop(1, tint(g.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A star: a wide soft halo and a bright core. */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  brightness: number,
) {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.6);
  halo.addColorStop(0, tint(color, 0.45 * brightness));
  halo.addColorStop(1, tint(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = Math.max(0.15, brightness);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Labels that make room for each other: draw the important ones first, and
 * skip any that would land on one already drawn this frame.
 */
export class LabelRoom {
  private boxes: { x: number; y: number; w: number; h: number }[] = [];
  reset() {
    this.boxes = [];
  }
  /** True when the box is free; it's then taken. */
  take(x: number, y: number, w: number, h: number): boolean {
    for (const b of this.boxes)
      if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return false;
    this.boxes.push({ x, y, w, h });
    return true;
  }
}

/** A rounded label, like a pill, on a dark glass. */
export function drawPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  glass: string,
  room: LabelRoom,
  force = false,
): boolean {
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + size * 1.1;
  const h = size * 1.7;
  if (!room.take(x - w / 2, y - h / 2, w, h) && !force) return false;
  ctx.fillStyle = glass;
  ctx.strokeStyle = tint(color, 0.55);
  ctx.lineWidth = size / 12;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + size * 0.05);
  return true;
}
