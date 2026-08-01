/**
 * Recorta sprites desde las imágenes fuente de /imagenes/_fuentes.
 *
 *   node scripts/slice-fuentes.mjs --preview   -> _preview-<fuente>.png con los
 *                                                recuadros dibujados, para revisar
 *   node scripts/slice-fuentes.mjs             -> escribe los recortes
 *
 * Coordenadas NORMALIZADAS (0..1) por fuente. Si un recorte sale corrido se
 * ajusta aquí y se vuelve a correr; los nombres de salida coinciden con
 * `src/game/assets/manifest.ts`, así que el juego los toma sin tocar código.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTES = path.join(root, 'imagenes', '_fuentes');
const OUT = path.join(root, 'imagenes');
const PREVIEW = process.argv.includes('--preview');

/**
 * fuente -> { destino: [x, y, w, h] normalizados }
 *
 * 2026-07-31: quedó solo la barra HUD. Los recortes de bt21/comida/botones se
 * eliminaron del juego (assets fuera de uso); sus fuentes siguen en _fuentes
 * por si se retoman — recuperar las regiones desde el historial de git.
 */
const SOURCES = {
  'interface_superior.png': {
    // barra HUD superior completa (logo + panel de score + SIGUIENTE)
    'ui/marco-hud': [0.02, 0.24, 0.965, 0.45],
  },
};

/**
 * Máscaras opcionales por recorte (coords normalizadas sobre el recorte).
 * Vuelven transparente todo lo que quede fuera de las formas — sirve para
 * quitar el fondo degradado que trae la fuente alrededor de la barra HUD.
 */
const MASKS = {
  'ui/marco-hud': (W, H) => {
    const rr = Math.round(0.0205 * W);
    return (
      // cuerpo de la barra
      `<rect x="${Math.round(0.003 * W)}" y="${Math.round(0.07 * H)}" ` +
      `width="${Math.round(0.993 * W)}" height="${Math.round(0.89 * H)}" rx="${rr}" fill="#fff"/>` +
      // alas negras del clip superior
      `<rect x="${Math.round(0.407 * W)}" y="${Math.round(0.05 * H)}" ` +
      `width="${Math.round(0.206 * W)}" height="${Math.round(0.17 * H)}" rx="${Math.round(0.012 * W)}" fill="#fff"/>` +
      // medallón del maki
      `<circle cx="${Math.round(0.5113 * W)}" cy="${Math.round(0.14 * H)}" r="${Math.round(0.0545 * W)}" fill="#fff"/>`
    );
  },
};

/**
 * Ancho máximo de salida por recorte (px). El lienzo del juego es 480 de
 * ancho a DPR 2, así que 960 es todo lo que una barra a pantalla completa
 * necesita — sin esto el marco-hud pesaba 1.4 MB.
 */
const RESIZE = {
  'ui/marco-hud': 960,
};

/** Recortes que salen en WebP (con alpha) en vez de PNG, por peso. */
const AS_WEBP = new Set(['ui/marco-hud']);

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let total = 0;
  for (const [srcName, regions] of Object.entries(SOURCES)) {
    const srcPath = path.join(FUENTES, srcName);
    if (!(await exists(srcPath))) {
      console.warn(`[slice] falta ${path.relative(root, srcPath)} — saltada`);
      continue;
    }
    const { width: W, height: H } = await sharp(srcPath).metadata();
    console.log(`[slice] ${srcName}: ${W}x${H}`);

    if (PREVIEW) {
      const rects = Object.entries(regions)
        .map(([name, [x, y, w, h]]) => {
          const px = Math.round(x * W);
          const py = Math.round(y * H);
          const pw = Math.round(w * W);
          const ph = Math.round(h * H);
          return (
            `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" ` +
            `fill="none" stroke="#00ff88" stroke-width="2"/>` +
            `<text x="${px + 2}" y="${py - 3}" font-size="11" fill="#00ff88">${name}</text>`
          );
        })
        .join('');
      const svg = Buffer.from(
        `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`
      );
      const out = path.join(OUT, `_preview-${srcName}`);
      await sharp(srcPath).composite([{ input: svg, top: 0, left: 0 }]).toFile(out);
      console.log(`[slice]   preview -> ${path.relative(root, out)}`);
      continue;
    }

    for (const [name, [x, y, w, h]] of Object.entries(regions)) {
      const webp = AS_WEBP.has(name);
      const dest = path.join(OUT, `${name}.${webp ? 'webp' : 'png'}`);
      await mkdir(path.dirname(dest), { recursive: true });
      const cw = Math.round(w * W);
      const ch = Math.round(h * H);
      let img = sharp(srcPath).extract({
        left: Math.round(x * W),
        top: Math.round(y * H),
        width: cw,
        height: ch,
      });
      const mask = MASKS[name];
      if (mask) {
        const svg = Buffer.from(
          `<svg width="${cw}" height="${ch}" xmlns="http://www.w3.org/2000/svg">${mask(cw, ch)}</svg>`
        );
        img = sharp(await img.png().toBuffer()).composite([
          { input: svg, blend: 'dest-in' },
        ]);
      }
      const maxW = RESIZE[name];
      if (maxW && cw > maxW) {
        img = sharp(await img.png().toBuffer()).resize({ width: maxW });
      }
      const buf = webp
        ? await img.webp({ quality: 86 }).toBuffer()
        : await img.png({ compressionLevel: 9 }).toBuffer();
      await writeFile(dest, buf);
      total++;
    }
  }
  if (!PREVIEW) {
    console.log(`[slice] ${total} recortes escritos en /imagenes`);
    console.log('[slice] siguiente paso: npm run assets:sync');
  }
}

main();
