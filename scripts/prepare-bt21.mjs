/**
 * Procesa los personajes de imagenes/_fuentes/bt21 -> imagenes/bt21/*.webp
 *
 * Mismo tratamiento que prepare-food:
 *   1. Si la imagen trae fondo horneado (esquinas opacas), se elimina con el
 *      flood-fill desde los bordes (caso chimmy.png, que llega a 1024x1536
 *      con fondo degradado).
 *   2. Trim del aire, lienzo cuadrado y máximo 256px (son avatares de UI).
 *   3. WebP con alpha, mismo nombre de archivo.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'imagenes', '_fuentes', 'bt21');
const OUT = path.join(root, 'imagenes', 'bt21');

const TARGET = 256; // px del lado del avatar final

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
    return d < 42;
  };

  for (let x = 0; x < w; x++) queue.push(idx(x, 0), idx(x, h - 1));
  for (let y = 0; y < h; y++) queue.push(idx(0, y), idx(w - 1, y));
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
 * Sombra difusa horneada: píxeles semitransparentes (alpha < 245) conectados
 * al borde de la imagen. Se eliminan con BFS; el personaje queda protegido
 * porque su contorno es opaco. Después se re-suaviza 1px el borde restante.
 */
function removeSoftShadow(data, w, h) {
  const visited = new Uint8Array(w * h);
  const queue = [];
  const idx = (x, y) => y * w + x;
  const soft = (i) => data[i * 4 + 3] < 245;

  for (let x = 0; x < w; x++) queue.push(idx(x, 0), idx(x, h - 1));
  for (let y = 0; y < h; y++) queue.push(idx(0, y), idx(w - 1, y));
  for (const i of queue) visited[i] = 1;

  let removed = 0;
  while (queue.length) {
    const i = queue.pop();
    if (!soft(i)) continue;
    if (data[i * 4 + 3] !== 0) removed++;
    data[i * 4 + 3] = 0;
    const x = i % w;
    const y = (i / w) | 0;
    const neigh = [];
    if (x > 0) neigh.push(i - 1);
    if (x < w - 1) neigh.push(i + 1);
    if (y > 0) neigh.push(i - w);
    if (y < h - 1) neigh.push(i + w);
    for (const n of neigh) {
      if (!visited[n] && soft(n)) {
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
  return removed;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const files = (await readdir(SRC)).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));

  for (const file of files) {
    const srcPath = path.join(SRC, file);
    const raw = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = raw.info;
    const data = raw.data;

    const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
    const baked = corners.some((c) => data[c + 3] > 40);
    if (baked) removeBackground(data, w, h);
    else removeSoftShadow(data, w, h);

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
    const name = path.parse(file).name;
    const out = await sharp(padded)
      .resize({ width: finalSize, height: finalSize })
      .webp({ quality: 88 })
      .toBuffer();

    await writeFile(path.join(OUT, `${name}.webp`), out);
    console.log(
      `[bt21] ${file} -> bt21/${name}.webp  (${finalSize}px${baked ? ', fondo eliminado' : ''})`
    );
  }
}

main();
