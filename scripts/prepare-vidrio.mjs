/**
 * imagenes/_fuentes/vidrio.png -> imagenes/ui/vidrio.webp
 * La vitrina se dibuja a ~445x732 unidades de diseño; 890px de ancho (2x) basta.
 */
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'imagenes', '_fuentes', 'vidrio.png');
const destDir = path.join(root, 'imagenes', 'ui');
const dest = path.join(destDir, 'vidrio.webp');

await mkdir(destDir, { recursive: true });
const info = await sharp(src).resize({ width: 890 }).webp({ quality: 88 }).toFile(dest);
console.log(`[vidrio] ${path.relative(root, dest)}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
