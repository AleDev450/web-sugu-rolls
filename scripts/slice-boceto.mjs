/**
 * Recorta el boceto en sprites sueltos.
 *
 *   1. Guarda el boceto como  imagenes/boceto.png
 *   2. npm run assets:slice -- --preview     -> genera imagenes/_preview-grid.png
 *      para verificar que los recuadros caen donde toca
 *   3. npm run assets:slice                  -> escribe los PNG recortados
 *
 * Las coordenadas son NORMALIZADAS (0..1) sobre el boceto completo, así que
 * funcionan con cualquier resolución del archivo fuente. Si un recorte sale
 * corrido, se ajusta aquí y se vuelve a correr: no hay que tocar el juego,
 * porque los nombres de salida ya coinciden con `src/game/assets/manifest.ts`.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'imagenes', 'boceto.png');
const OUT = path.join(root, 'imagenes');

const PREVIEW = process.argv.includes('--preview');

/** [x, y, w, h] normalizados. Ajustar aquí si un recorte sale mal encuadrado. */
const REGIONS = {
  // --- cadena de evolución: 2 filas de 5 ---
  'sushi/01-onigiri': [0.035, 0.655, 0.085, 0.055],
  'sushi/02-gyoza': [0.135, 0.655, 0.085, 0.055],
  'sushi/03-hosomaki': [0.235, 0.655, 0.085, 0.055],
  'sushi/04-futomaki': [0.335, 0.655, 0.085, 0.055],
  'sushi/05-ebi-roll': [0.44, 0.655, 0.085, 0.055],
  'sushi/06-california-roll': [0.035, 0.745, 0.085, 0.06],
  'sushi/07-dragon-roll': [0.135, 0.745, 0.085, 0.06],
  'sushi/08-acevichado-roll': [0.235, 0.745, 0.085, 0.06],
  'sushi/09-sugu-especial': [0.335, 0.745, 0.09, 0.06],
  'sushi/10-sugu-supreme': [0.44, 0.74, 0.095, 0.07],

  // --- panel BT21: personaje + su plato, 4 filas de 2 columnas ---
  'bt21/rj': [0.605, 0.13, 0.075, 0.05],
  'comida/onigiri': [0.695, 0.13, 0.075, 0.05],
  'bt21/tata': [0.805, 0.13, 0.075, 0.05],
  'comida/bubble-tea': [0.895, 0.13, 0.075, 0.05],

  'bt21/cooky': [0.605, 0.222, 0.075, 0.055],
  'comida/dragon-roll': [0.695, 0.225, 0.075, 0.05],
  'bt21/chimmy': [0.805, 0.222, 0.075, 0.055],
  'comida/california-roll': [0.895, 0.225, 0.075, 0.05],

  'bt21/mang': [0.605, 0.318, 0.075, 0.055],
  'comida/temaki': [0.695, 0.32, 0.075, 0.05],
  'bt21/koya': [0.805, 0.318, 0.075, 0.055],
  'comida/ramen': [0.895, 0.32, 0.075, 0.05],

  'bt21/shooky': [0.605, 0.412, 0.075, 0.05],
  'comida/mochi': [0.695, 0.415, 0.075, 0.045],
  'bt21/van': [0.805, 0.412, 0.075, 0.05],
  'comida/bento': [0.895, 0.415, 0.075, 0.045],

  // --- power ups: 2 filas de 4 ---
  'powerups/martillo': [0.607, 0.512, 0.055, 0.028],
  'powerups/congelar': [0.703, 0.512, 0.055, 0.028],
  'powerups/bomba': [0.8, 0.512, 0.055, 0.028],
  'powerups/mezclar': [0.897, 0.512, 0.055, 0.028],
  'powerups/sushi-dorado': [0.607, 0.588, 0.055, 0.028],
  'powerups/maneki-neko': [0.703, 0.588, 0.055, 0.028],
  'powerups/palillos': [0.8, 0.588, 0.055, 0.028],
  'powerups/wasabi': [0.897, 0.588, 0.055, 0.028],

  // --- ambientación (fondos) ---
  'fondos/fachada': [0.005, 0.885, 0.163, 0.098],
  'fondos/interior': [0.175, 0.885, 0.163, 0.098],
  'fondos/puente': [0.345, 0.885, 0.163, 0.098],

  // --- elementos de UI ---
  'ui/panel-madera': [0.545, 0.895, 0.075, 0.035],
  'ui/panel-oscuro': [0.635, 0.895, 0.075, 0.035],
  'ui/btn-home': [0.545, 0.945, 0.045, 0.03],
  'ui/btn-play': [0.605, 0.945, 0.045, 0.03],
  'ui/btn-shop': [0.665, 0.945, 0.045, 0.03],
  'ui/btn-restart': [0.725, 0.945, 0.045, 0.03],
  'ui/banner-sugu': [0.885, 0.895, 0.105, 0.09],
  'ui/logo': [0.6, 0.005, 0.38, 0.085],
};

async function main() {
  try {
    await access(SRC);
  } catch {
    console.error(
      `\n[slice] No encuentro ${path.relative(root, SRC)}\n` +
        `        Guarda el boceto ahí (PNG o JPG renombrado a .png) y vuelve a correr.\n`
    );
    process.exit(1);
  }

  const img = sharp(SRC);
  const { width: W, height: H } = await img.metadata();
  console.log(`[slice] boceto: ${W}x${H}`);

  if (PREVIEW) {
    const rects = Object.entries(REGIONS)
      .map(([name, [x, y, w, h]]) => {
        const px = Math.round(x * W);
        const py = Math.round(y * H);
        const pw = Math.round(w * W);
        const ph = Math.round(h * H);
        return (
          `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" ` +
          `fill="none" stroke="#00ff88" stroke-width="3"/>` +
          `<text x="${px + 3}" y="${py - 4}" font-size="13" fill="#00ff88">${name}</text>`
        );
      })
      .join('');
    const svg = Buffer.from(
      `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`
    );
    const out = path.join(OUT, '_preview-grid.png');
    await sharp(SRC).composite([{ input: svg, top: 0, left: 0 }]).toFile(out);
    console.log(`[slice] preview -> ${path.relative(root, out)}`);
    return;
  }

  let n = 0;
  for (const [name, [x, y, w, h]] of Object.entries(REGIONS)) {
    const dest = path.join(OUT, `${name}.png`);
    await mkdir(path.dirname(dest), { recursive: true });
    const buf = await sharp(SRC)
      .extract({
        left: Math.round(x * W),
        top: Math.round(y * H),
        width: Math.round(w * W),
        height: Math.round(h * H),
      })
      .png()
      .toBuffer();
    await writeFile(dest, buf);
    n++;
  }
  console.log(`[slice] ${n} recortes escritos en /imagenes`);
  console.log(`[slice] siguiente paso: npm run assets:sync`);
}

main();
