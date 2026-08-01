/**
 * Copia /imagenes -> /public/imagenes.
 *
 * La carpeta `imagenes/` de la raíz es la FUENTE DE VERDAD: ahí se cambian,
 * reemplazan o añaden sprites. `public/imagenes/` es una copia generada
 * (está en .gitignore) porque Next solo sirve estáticos desde /public.
 *
 * Se ejecuta solo en `predev` y `prebuild`; también a mano con
 * `npm run assets:sync`.
 */
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'imagenes');
const dest = path.join(root, 'public', 'imagenes');

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(src))) {
  await mkdir(src, { recursive: true });
  console.log('[assets] creada /imagenes (vacía) — el juego usará placeholders.');
}

await rm(dest, { recursive: true, force: true });
await mkdir(path.dirname(dest), { recursive: true });
// Los archivos/carpetas con prefijo "_" (fuentes, previews) no se publican:
// son material de trabajo, no assets del juego.
await cp(src, dest, {
  recursive: true,
  filter: (s) => !path.basename(s).startsWith('_'),
});

console.log(`[assets] /imagenes -> /public/imagenes (sin _fuentes/_previews)`);
