/**
 * Convierte el background fuente a un WebP optimizado para el juego.
 * El lienzo de diseño es 480x854 y cargamos a DPR 2 => 960px de ancho basta.
 */
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'imagenes', '_fuentes', 'background.png');
const destDir = path.join(root, 'imagenes', 'fondos');
const dest = path.join(destDir, 'background.webp');

await mkdir(destDir, { recursive: true });
const info = await sharp(src).resize({ width: 960 }).webp({ quality: 82 }).toFile(dest);
console.log(`[bg] ${path.relative(root, dest)}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
