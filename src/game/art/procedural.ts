/**
 * Arte de reemplazo (placeholder).
 *
 * Portado del render Canvas2D del prototipo `sugu-rolls.html`. Cada tier se
 * dibuja UNA vez a un canvas offscreen y se convierte en textura de Pixi, así
 * que en runtime cuesta lo mismo que un sprite normal.
 *
 * En cuanto exista `/imagenes/sushi/NN-nombre.png`, `textures.ts` usa el PNG y
 * esto deja de ejecutarse. No borrar: es la red de seguridad si falta un asset.
 */

import { TIERS, type Tier } from '@/game/config/tiers';

/** Resolución del placeholder: 2x el radio de diseño, con margen para la cara. */
const PADDING = 1.18;

function hexToRgb(h: string) {
  let s = h.replace('#', '');
  if (s.length === 3)
    s = s
      .split('')
      .map((x) => x + x)
      .join('');
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

function lighten(hex: string, amt: number) {
  const c = hexToRgb(hex);
  return `rgb(${clamp(c.r + amt, 0, 255)},${clamp(c.g + amt, 0, 255)},${clamp(c.b + amt, 0, 255)})`;
}

function radialFill(
  g: CanvasRenderingContext2D,
  r: number,
  c1: string,
  c2: string
) {
  const rg = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  rg.addColorStop(0, lighten(c1, 18));
  rg.addColorStop(0.6, c1);
  rg.addColorStop(1, c2);
  g.fillStyle = rg;
}

/** Semilla fija por tier: el placeholder debe verse igual en cada partida. */
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function speckle(g: CanvasRenderingContext2D, r: number, rnd: () => number) {
  g.fillStyle = 'rgba(255,255,255,.55)';
  const n = Math.max(4, Math.round(r / 6));
  for (let i = 0; i < n; i++) {
    const a = rnd() * 7;
    const d = rnd() * r * 0.7;
    g.beginPath();
    g.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * 0.035, r * 0.025, a, 0, 7);
    g.fill();
  }
}

function speckleRing(
  g: CanvasRenderingContext2D,
  ro: number,
  ri: number,
  rnd: () => number
) {
  g.fillStyle = 'rgba(255,255,255,.5)';
  const n = Math.max(6, Math.round(ro / 4));
  for (let i = 0; i < n; i++) {
    const a = rnd() * 7;
    const d = ri + rnd() * (ro - ri);
    g.beginPath();
    g.ellipse(Math.cos(a) * d, Math.sin(a) * d, ro * 0.03, ro * 0.022, a, 0, 7);
    g.fill();
  }
}

function star(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save();
  g.translate(x, y);
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 ? s * 0.4 : s;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.restore();
}

// ---------- cuerpos por tipo ----------

function onigiri(g: CanvasRenderingContext2D, r: number, t: Tier, rnd: () => number) {
  radialFill(g, r, t.palette.base, t.palette.accent);
  const R = r * 1.02;
  g.beginPath();
  g.moveTo(0, -R);
  g.quadraticCurveTo(R * 0.9, -R * 0.5, R * 0.82, R * 0.6);
  g.quadraticCurveTo(R * 0.5, R * 0.9, 0, R * 0.86);
  g.quadraticCurveTo(-R * 0.5, R * 0.9, -R * 0.82, R * 0.6);
  g.quadraticCurveTo(-R * 0.9, -R * 0.5, 0, -R);
  g.closePath();
  g.fill();
  speckle(g, r * 0.85, rnd);
  g.fillStyle = t.palette.wrap ?? '#2b3540';
  g.beginPath();
  g.roundRect(-r * 0.7, r * 0.3, r * 1.4, r * 0.52, r * 0.08);
  g.fill();
}

function gyoza(g: CanvasRenderingContext2D, r: number, t: Tier, rnd: () => number) {
  radialFill(g, r, t.palette.base, t.palette.accent);
  g.beginPath();
  g.ellipse(0, r * 0.08, r * 0.98, r * 0.76, 0, 0, 7);
  g.fill();
  // repulgue superior
  g.strokeStyle = t.palette.wrap ?? '#c9ad7c';
  g.lineWidth = r * 0.07;
  g.lineCap = 'round';
  for (let i = -3; i <= 3; i++) {
    const x = i * r * 0.26;
    g.beginPath();
    g.moveTo(x, -r * 0.5);
    g.quadraticCurveTo(x + r * 0.1, -r * 0.72, x + r * 0.2, -r * 0.5);
    g.stroke();
  }
  // dorado de plancha
  g.fillStyle = 'rgba(190,140,80,.28)';
  g.beginPath();
  g.ellipse(0, r * 0.5, r * 0.7, r * 0.2, 0, 0, 7);
  g.fill();
  speckle(g, r * 0.5, rnd);
}

function maki(g: CanvasRenderingContext2D, r: number, t: Tier, rnd: () => number) {
  g.fillStyle = t.palette.base;
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.fill();
  g.strokeStyle = 'rgba(120,150,120,.35)';
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.arc(0, 0, r * 0.94, 0, 7);
  g.stroke();

  radialFill(g, r * 0.82, '#fbf6ec', '#e9dcc4');
  g.beginPath();
  g.arc(0, 0, r * 0.82, 0, 7);
  g.fill();
  speckleRing(g, r * 0.82, r * 0.55, rnd);

  const fill = t.palette.fill ?? t.palette.accent;
  const rg = g.createRadialGradient(-r * 0.15, -r * 0.15, 2, 0, 0, r * 0.5);
  rg.addColorStop(0, lighten(fill, 20));
  rg.addColorStop(1, fill);
  g.fillStyle = rg;
  g.beginPath();
  g.arc(0, 0, r * 0.5, 0, 7);
  g.fill();
}

function futomaki(g: CanvasRenderingContext2D, r: number, t: Tier, rnd: () => number) {
  g.fillStyle = t.palette.base;
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.fill();
  radialFill(g, r * 0.86, '#fbf6ec', '#e9dcc4');
  g.beginPath();
  g.arc(0, 0, r * 0.86, 0, 7);
  g.fill();
  speckleRing(g, r * 0.86, r * 0.6, rnd);

  const cols = ['#f4784f', '#8bd18b', '#f4d06b', '#f4a86b', '#e8a0c0'];
  const inner = r * 0.6;
  g.save();
  g.beginPath();
  g.arc(0, 0, inner, 0, 7);
  g.clip();
  for (let i = 0; i < cols.length; i++) {
    const a = (i / cols.length) * Math.PI * 2;
    g.fillStyle = cols[i];
    g.beginPath();
    g.arc(Math.cos(a) * inner * 0.5, Math.sin(a) * inner * 0.5, inner * 0.42, 0, 7);
    g.fill();
  }
  g.fillStyle = '#f4d06b';
  g.beginPath();
  g.arc(0, 0, inner * 0.3, 0, 7);
  g.fill();
  g.restore();
}

function ebiRoll(g: CanvasRenderingContext2D, r: number, t: Tier, rnd: () => number) {
  radialFill(g, r, t.palette.base, '#eaddc4');
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.fill();
  speckleRing(g, r, r * 0.62, rnd);
  // lomo de langostino encima
  const fill = t.palette.fill ?? '#f4956b';
  g.save();
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.clip();
  const grd = g.createLinearGradient(0, -r * 0.9, 0, r * 0.2);
  grd.addColorStop(0, lighten(fill, 30));
  grd.addColorStop(1, fill);
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(0, -r * 0.42, r * 0.88, r * 0.46, 0, 0, 7);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,.5)';
  g.lineWidth = r * 0.05;
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(i * r * 0.3, -r * 0.8);
    g.lineTo(i * r * 0.3 + r * 0.06, -r * 0.06);
    g.stroke();
  }
  g.restore();
  g.fillStyle = '#1b232b';
  g.beginPath();
  g.arc(0, r * 0.3, r * 0.34, 0, 7);
  g.fill();
}

function california(g: CanvasRenderingContext2D, r: number, t: Tier, rnd: () => number) {
  radialFill(g, r, '#fbf6ec', '#eaddc4');
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.fill();
  speckleRing(g, r, r * 0.62, rnd);
  // huevas por fuera
  g.fillStyle = t.palette.accent;
  const n = Math.max(10, Math.round(r / 3));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.beginPath();
    g.arc(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.05, 0, 7);
    g.fill();
  }
  g.fillStyle = '#1b232b';
  g.beginPath();
  g.arc(0, 0, r * 0.6, 0, 7);
  g.fill();
  g.fillStyle = '#8bd18b';
  g.beginPath();
  g.arc(-r * 0.18, 0, r * 0.16, 0, 7);
  g.fill();
  g.fillStyle = '#f4a86b';
  g.beginPath();
  g.arc(r * 0.16, -r * 0.06, r * 0.14, 0, 7);
  g.fill();
  g.fillStyle = '#f4d06b';
  g.beginPath();
  g.arc(0, r * 0.2, r * 0.1, 0, 7);
  g.fill();
}

function dragon(g: CanvasRenderingContext2D, r: number) {
  radialFill(g, r, '#fbf6ec', '#eaddc4');
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.clip();
  for (let row = 0; row < 4; row++) {
    for (let i = -4; i <= 4; i++) {
      const px = i * r * 0.28;
      const py = -r * 0.9 + row * r * 0.42;
      const grd = g.createLinearGradient(px, py - r * 0.2, px, py + r * 0.2);
      grd.addColorStop(0, '#a8d47c');
      grd.addColorStop(1, '#7fae4f');
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(px, py, r * 0.2, r * 0.11, 0, 0, 7);
      g.fill();
      g.strokeStyle = 'rgba(90,130,60,.4)';
      g.lineWidth = r * 0.015;
      g.stroke();
    }
  }
  g.restore();
  g.strokeStyle = 'rgba(90,50,20,.5)';
  g.lineWidth = r * 0.06;
  g.beginPath();
  g.moveTo(-r * 0.6, -r * 0.2);
  g.quadraticCurveTo(0, r * 0.1, r * 0.6, -r * 0.2);
  g.stroke();
}

function acevichado(g: CanvasRenderingContext2D, r: number, rnd: () => number) {
  radialFill(g, r, '#fbf6ec', '#eaddc4');
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.fill();
  // láminas de salmón en abanico
  g.save();
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.clip();
  const cols = ['#f4784f', '#f4956b', '#f4a86b', '#f28a5f', '#f4784f'];
  for (let i = 0; i < cols.length; i++) {
    const px = -r * 0.7 + i * r * 0.36;
    const grd = g.createLinearGradient(px, -r, px, r * 0.4);
    grd.addColorStop(0, lighten(cols[i], 26));
    grd.addColorStop(1, cols[i]);
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(px, -r * 0.15, r * 0.3, r * 0.85, 0.18, 0, 7);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.4)';
    g.lineWidth = r * 0.03;
    g.stroke();
  }
  // salsa acevichada
  g.fillStyle = 'rgba(242,193,78,.55)';
  g.beginPath();
  g.ellipse(0, -r * 0.1, r * 0.62, r * 0.3, 0, 0, 7);
  g.fill();
  g.restore();
  g.fillStyle = '#f4784f';
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    g.arc((rnd() - 0.5) * r * 1.5, (rnd() - 0.5) * r * 1.5, r * 0.035, 0, 7);
    g.fill();
  }
}

function especial(g: CanvasRenderingContext2D, r: number, rnd: () => number) {
  g.fillStyle = '#1a2129';
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.fill();
  radialFill(g, r * 0.9, '#fbf6ec', '#eaddc4');
  g.beginPath();
  g.arc(0, 0, r * 0.9, 0, 7);
  g.fill();
  speckleRing(g, r * 0.9, r * 0.66, rnd);
  const items: [string, number, number, number][] = [
    ['#f4784f', -0.3, -0.2, 0.32],
    ['#8bd18b', 0.28, -0.16, 0.28],
    ['#f4a86b', 0.02, 0.24, 0.3],
    ['#e8a0c0', -0.26, 0.26, 0.24],
    ['#f4d06b', 0.32, 0.26, 0.22],
  ];
  g.save();
  g.beginPath();
  g.arc(0, 0, r * 0.9, 0, 7);
  g.clip();
  for (const [c, dx, dy, sz] of items) {
    const grd = g.createRadialGradient(dx * r, dy * r - 2, 2, dx * r, dy * r, sz * r);
    grd.addColorStop(0, lighten(c, 22));
    grd.addColorStop(1, c);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(dx * r, dy * r, sz * r, 0, 7);
    g.fill();
  }
  g.restore();
}

function supreme(g: CanvasRenderingContext2D, r: number, rnd: () => number) {
  const glow = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.18);
  glow.addColorStop(0, 'rgba(242,193,78,.5)');
  glow.addColorStop(1, 'rgba(242,193,78,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, r * 1.18, 0, 7);
  g.fill();

  g.fillStyle = '#1a2129';
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.fill();
  radialFill(g, r * 0.9, '#ffe9a8', '#f2c14e');
  g.beginPath();
  g.arc(0, 0, r * 0.9, 0, 7);
  g.fill();

  const items: [string, number, number, number][] = [
    ['#f4784f', -0.3, -0.2, 0.34],
    ['#8bd18b', 0.25, -0.15, 0.3],
    ['#f4a86b', 0, 0.2, 0.32],
    ['#e8a0c0', -0.25, 0.25, 0.26],
    ['#f4d06b', 0.3, 0.25, 0.24],
    ['#f4956b', -0.05, -0.35, 0.24],
  ];
  g.save();
  g.beginPath();
  g.arc(0, 0, r * 0.9, 0, 7);
  g.clip();
  for (const [c, dx, dy, sz] of items) {
    const grd = g.createRadialGradient(dx * r, dy * r - 2, 2, dx * r, dy * r, sz * r);
    grd.addColorStop(0, lighten(c, 20));
    grd.addColorStop(1, c);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(dx * r, dy * r, sz * r, 0, 7);
    g.fill();
  }
  g.fillStyle = '#f4784f';
  for (let i = 0; i < 20; i++) {
    g.beginPath();
    g.arc((rnd() - 0.5) * r * 1.6, (rnd() - 0.5) * r * 1.6, r * 0.04, 0, 7);
    g.fill();
  }
  g.restore();

  g.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57;
    star(g, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.09);
  }
}

// ---------- cara kawaii ----------

function drawFace(g: CanvasRenderingContext2D, r: number, isSupreme: boolean) {
  const eyeY = -r * 0.05;
  const eyeX = r * 0.34;
  const eyeR = Math.max(1.6, r * 0.11);

  g.fillStyle = 'rgba(244,140,160,.55)';
  g.beginPath();
  g.ellipse(-eyeX * 1.15, r * 0.16, r * 0.13, r * 0.08, 0, 0, 7);
  g.fill();
  g.beginPath();
  g.ellipse(eyeX * 1.15, r * 0.16, r * 0.13, r * 0.08, 0, 0, 7);
  g.fill();

  for (const ex of [-eyeX, eyeX]) {
    if (isSupreme) {
      g.fillStyle = '#fff';
      star(g, ex, eyeY, eyeR * 1.2);
      g.fillStyle = '#f2c14e';
      star(g, ex, eyeY, eyeR * 0.7);
    } else {
      g.fillStyle = '#2a1a10';
      g.beginPath();
      g.arc(ex, eyeY, eyeR, 0, 7);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(ex - eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.4, 0, 7);
      g.fill();
    }
  }

  g.strokeStyle = '#2a1a10';
  g.lineWidth = Math.max(1.4, r * 0.05);
  g.lineCap = 'round';
  g.beginPath();
  g.arc(0, r * 0.14, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
}

/**
 * Dibuja el tier completo en un canvas cuadrado listo para volverse textura.
 * `pixelRadius` es el radio en píxeles reales (ya multiplicado por DPR/escala).
 */
export function renderTierCanvas(tierIndex: number, pixelRadius: number): HTMLCanvasElement {
  const t = TIERS[tierIndex];
  const size = Math.ceil(pixelRadius * 2 * PADDING);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.translate(size / 2, size / 2);

  const rnd = makeRng((tierIndex + 1) * 9176);
  const r = pixelRadius;

  switch (t.kind) {
    case 'onigiri':
      onigiri(g, r, t, rnd);
      break;
    case 'gyoza':
      gyoza(g, r, t, rnd);
      break;
    case 'maki':
      maki(g, r, t, rnd);
      break;
    case 'futomaki':
      futomaki(g, r, t, rnd);
      break;
    case 'roll':
      ebiRoll(g, r, t, rnd);
      break;
    case 'california':
      california(g, r, t, rnd);
      break;
    case 'dragon':
      dragon(g, r);
      break;
    case 'acevichado':
      acevichado(g, r, rnd);
      break;
    case 'especial':
      especial(g, r, rnd);
      break;
    case 'supreme':
      supreme(g, r, rnd);
      break;
  }

  drawFace(g, r, t.kind === 'supreme');
  return canvas;
}
