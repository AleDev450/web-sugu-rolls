/**
 * Genera plantillas guía para diseñar assets:
 *
 *   imagenes/_fuentes/guia-background.png  (1080x1920)
 *     -> qué zonas del fondo quedan tapadas por la UI y cuáles se ven
 *
 *   imagenes/_fuentes/guia-vidrio.png      (840x1240)
 *     -> lienzo del vidrio: dónde va la ventana transparente y los bordes
 *
 * Se diseña ENCIMA de estas plantillas (o respetando sus medidas) y luego
 * se entrega el arte final sin las marcas.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'imagenes', '_fuentes');

// ---------- guía del background (1080x1920, 9:16 como el juego) ----------
{
  const W = 1080;
  const H = 1920;
  // el lienzo de diseño del juego es 480x854 -> factor 2.25
  const k = W / 480;
  const hudH = Math.round(151 * k); // barra HUD
  const bx = Math.round(50 * k);
  const by = Math.round(210 * k);
  const bw = Math.round(380 * k);
  const bh = Math.round(560 * k);

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>text{font-family:Arial,sans-serif;font-weight:bold}</style>
  <rect width="${W}" height="${H}" fill="#2b2118"/>
  <!-- zona HUD -->
  <rect x="0" y="0" width="${W}" height="${hudH}" fill="#c0392b" fill-opacity="0.4" stroke="#e05a4c" stroke-width="4"/>
  <text x="${W / 2}" y="${hudH / 2}" font-size="44" fill="#fff" text-anchor="middle">TAPADO POR LA BARRA HUD</text>
  <!-- zona vidrio -->
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#2980b9" fill-opacity="0.35" stroke="#5aa8e0" stroke-width="4" stroke-dasharray="18 12"/>
  <text x="${W / 2}" y="${by + 70}" font-size="40" fill="#cfe8ff" text-anchor="middle">DETRÁS DEL VIDRIO</text>
  <text x="${W / 2}" y="${by + 125}" font-size="30" fill="#cfe8ff" text-anchor="middle">(se ve atenuado, sin detalles importantes)</text>
  <!-- zonas visibles -->
  <text x="${W / 2}" y="${hudH + 90}" font-size="34" fill="#9fe0a0" text-anchor="middle">VISIBLE (franja entre HUD y vidrio)</text>
  <text x="${W / 2}" y="${by + bh + 90}" font-size="34" fill="#9fe0a0" text-anchor="middle">VISIBLE (piso)</text>
  <text x="${Math.round(bx / 2)}" y="${by + bh / 2}" font-size="30" fill="#9fe0a0" text-anchor="middle" transform="rotate(-90 ${Math.round(bx / 2)} ${by + bh / 2})">VISIBLE</text>
  <text x="${W - Math.round(bx / 2)}" y="${by + bh / 2}" font-size="30" fill="#9fe0a0" text-anchor="middle" transform="rotate(90 ${W - Math.round(bx / 2)} ${by + bh / 2})">VISIBLE</text>
  <text x="${W / 2}" y="${H - 30}" font-size="26" fill="#888" text-anchor="middle">background: 1080 x 1920 px (9:16)</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, 'guia-background.png'));
  console.log('[guia] guia-background.png 1080x1920');
}

// ---------- guía del vidrio (840x1240 @2x => 420x620 en el juego) ----------
{
  const W = 840;
  const H = 1240;
  const win = { x: 40, y: 40, w: 760, h: 1120 }; // ventana interior transparente

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>text{font-family:Arial,sans-serif;font-weight:bold}</style>
  <!-- damero de fondo = transparencia -->
  <defs>
    <pattern id="chk" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="#bbb"/>
      <rect width="20" height="20" fill="#ddd"/>
      <rect x="20" y="20" width="20" height="20" fill="#ddd"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#chk)"/>
  <!-- marco = donde va tu diseño -->
  <path fill-rule="evenodd" fill="#8a5a3a" fill-opacity="0.75"
    d="M0 0 H${W} V${H} H0 Z
       M${win.x} ${win.y} H${win.x + win.w} V${win.y + win.h} H${win.x} Z"/>
  <rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" fill="none" stroke="#e05a4c" stroke-width="5" stroke-dasharray="22 14"/>
  <text x="${W / 2}" y="${win.y + 60}" font-size="34" fill="#ffdddd" text-anchor="middle">INTERIOR: transparente u</text>
  <text x="${W / 2}" y="${win.y + 105}" font-size="34" fill="#ffdddd" text-anchor="middle">alpha muy bajo (vidrio)</text>
  <text x="${W / 2}" y="${win.y + win.h / 2}" font-size="40" fill="#fff" fill-opacity="0.5" text-anchor="middle">ventana 760 x 1120</text>
  <text x="${W / 2}" y="26" font-size="24" fill="#fff" text-anchor="middle">borde superior: 40 px (fino, la pieza entra por aquí)</text>
  <text x="${W / 2}" y="${H - 55}" font-size="26" fill="#fff" text-anchor="middle">base: 80 px (madera / bandeja)</text>
  <text x="${W / 2}" y="${H - 18}" font-size="24" fill="#fff" text-anchor="middle">vidrio: 840 x 1240 px · PNG con transparencia</text>
  <text x="24" y="${H / 2}" font-size="24" fill="#fff" text-anchor="middle" transform="rotate(-90 24 ${H / 2})">pared: 40 px</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, 'guia-vidrio.png'));
  console.log('[guia] guia-vidrio.png 840x1240');
}
