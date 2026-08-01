/**
 * Procesa las comidas de imagenes/_fuentes/food -> imagenes/sushi/*.webp
 *
 * Por cada imagen:
 *   1. Si trae fondo horneado (esquinas opacas), lo elimina con un flood-fill
 *      desde los bordes que avanza mientras el color cambie suavemente
 *      (el degradado del fondo) y se detiene en el contorno del dibujo.
 *   2. Recorta el aire (trim), centra en lienzo cuadrado y reduce a 512px.
 *   3. Exporta WebP con alpha, con el nombre que espera el manifest.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'imagenes', '_fuentes', 'food');
const OUT = path.join(root, 'imagenes', 'sushi');

/** archivo fuente -> nombre de sprite del manifest (orden de la cadena) */
const MAP = {
  'onigiri.png': '01-onigiri',
  'gyoza.png': '02-gyoza',
  'hosomaki.png': '03-hosomaki',
  'temaki.png': '04-temaki',
  'ebi.png': '05-ebi-roll',
  'pokebowl.png': '06-pokebowl',
  'dragon_roll.png': '07-dragon-roll',
  'acevichado.png': '08-acevichado-roll',
  'especial_maki.png': '09-sugu-especial',
  'sugu.png': '10-sugu-supreme',
};

const TARGET = 512; // px del lado mayor del sprite final

/** flood-fill desde el borde: borra el fondo aunque sea un degradado */
function removeBackground(data, w, h) {
  const visited = new Uint8Array(w * h);
  const queue = [];
  const idx = (x, y) => y * w + x;

  const smooth = (a, b) => {
    const d =
      Math.abs(data[a * 4] - data[b * 4]) +
      Math.abs(data[a * 4 + 1] - data[b * 4 + 1]) +
      Math.abs(data[a * 4 + 2] - data[b * 4 + 2]);
    return d < 42; // salto de color pequeño = seguimos en el fondo
  };

  for (let x = 0; x < w; x++) {
    queue.push(idx(x, 0), idx(x, h - 1));
  }
  for (let y = 0; y < h; y++) {
    queue.push(idx(0, y), idx(w - 1, y));
  }
  for (const i of queue) visited[i] = 1;

  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i / w) | 0;
    const neigh = [];
    if (x > 0) neigh.push(i - 1);
    if (x < w - 1) neigh.push(i + 1);
    if (y > 0) neigh.push(i - w);
    if (y < h - 1) neigh.push(i + w);
    for (const n of neigh) {
      if (!visited[n] && smooth(i, n)) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  // borra lo visitado y suaviza 1px del borde restante
  for (let i = 0; i < w * h; i++) {
    if (visited[i]) data[i * 4 + 3] = 0;
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y);
      if (data[i * 4 + 3] === 0) continue;
      if (
        data[(i - 1) * 4 + 3] === 0 ||
        data[(i + 1) * 4 + 3] === 0 ||
        data[(i - w) * 4 + 3] === 0 ||
        data[(i + w) * 4 + 3] === 0
      ) {
        data[i * 4 + 3] = Math.min(data[i * 4 + 3], 160);
      }
    }
  }
}

/**
 * Halo claro residual: sombra casi-blanca pegada al contorno que el flood-fill
 * del fondo no alcanzó (caso onigiri). Se come desde el exterior transparente
 * los píxeles casi blancos y de baja saturación; el dibujo queda protegido por
 * su contorno oscuro. Después se re-suaviza 1px el borde.
 */
function removePaleHalo(data, w, h) {
  const visited = new Uint8Array(w * h);
  const queue = [];
  const idx = (x, y) => y * w + x;
  const eatable = (i) => {
    const a = data[i * 4 + 3];
    if (a < 10) return true;
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return min >= 185 && max - min <= 50;
  };

  for (let x = 0; x < w; x++) queue.push(idx(x, 0), idx(x, h - 1));
  for (let y = 0; y < h; y++) queue.push(idx(0, y), idx(w - 1, y));
  for (const i of queue) visited[i] = 1;

  while (queue.length) {
    const i = queue.pop();
    if (!eatable(i)) continue;
    data[i * 4 + 3] = 0;
    const x = i % w;
    const y = (i / w) | 0;
    const neigh = [];
    if (x > 0) neigh.push(i - 1);
    if (x < w - 1) neigh.push(i + 1);
    if (y > 0) neigh.push(i - w);
    if (y < h - 1) neigh.push(i + w);
    for (const n of neigh) {
      if (!visited[n] && eatable(n)) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y);
      if (data[i * 4 + 3] === 0) continue;
      if (
        data[(i - 1) * 4 + 3] === 0 ||
        data[(i + 1) * 4 + 3] === 0 ||
        data[(i - w) * 4 + 3] === 0 ||
        data[(i + w) * 4 + 3] === 0
      ) {
        data[i * 4 + 3] = Math.min(data[i * 4 + 3], 160);
      }
    }
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });

  for (const [file, sprite] of Object.entries(MAP)) {
    const srcPath = path.join(SRC, file);
    const raw = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = raw.info;
    const data = raw.data;

    // ¿esquinas opacas? -> fondo horneado
    const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
    const baked = corners.some((c) => data[c + 3] > 40);
    if (baked) removeBackground(data, w, h);
    removePaleHalo(data, w, h);

    // trim + cuadrado + resize
    let img = sharp(data, { raw: { width: w, height: h, channels: 4 } }).png();
    img = sharp(await img.toBuffer()).trim({ threshold: 12 });
    const trimmed = await img.png().toBuffer();
    const meta = await sharp(trimmed).metadata();
    const side = Math.max(meta.width, meta.height);
    const padded = await sharp(trimmed)
      .extend({
        top: Math.floor((side - meta.height) / 2),
        bottom: Math.ceil((side - meta.height) / 2),
        left: Math.floor((side - meta.width) / 2),
        right: Math.ceil((side - meta.width) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();

    const finalSize = Math.min(TARGET, side);
    const out = await sharp(padded)
      .resize({ width: finalSize, height: finalSize })
      .webp({ quality: 88 })
      .toBuffer();

    await writeFile(path.join(OUT, `${sprite}.webp`), out);
    console.log(
      `[food] ${file} -> sushi/${sprite}.webp  (${finalSize}px${baked ? ', fondo eliminado' : ''})`
    );
  }
}

main();
