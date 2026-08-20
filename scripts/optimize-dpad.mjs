/**
 * Convierte la cruceta fuente de Sugu Maki Maze a un WebP que pese poco.
 *
 * El PNG que sube Alejandro es de 1254x1254 (~960 KB) y en pantalla la cruceta
 * nunca pasa de 200 px de lado: a DPR 3 son 600 px, así que 640 sobra y el
 * archivo baja a unas pocas decenas de KB. El fuente se queda donde está por si
 * hay que volver a generarlo.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'public', 'games', 'sugu-maki-maze');
const src = path.join(dir, 'jostick.png');
const dest = path.join(dir, 'dpad.webp');

const info = await sharp(src)
  .resize({ width: 640, height: 640, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 86, alphaQuality: 90 })
  .toFile(dest);

console.log(`[dpad] ${path.relative(root, dest)}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
