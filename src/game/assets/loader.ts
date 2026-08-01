import { Assets, Texture } from 'pixi.js';
import { allAssetEntries, assetUrl, type AssetGroup } from './manifest';

/**
 * Carga tolerante a fallos: cada imagen que no exista simplemente no entra al
 * registro, y quien la pida recibe `null` para poder dibujar su fallback.
 * Así el proyecto arranca con /imagenes vacía y se va llenando sin tocar código.
 */

const textures = new Map<string, Texture>();
const missing = new Set<string>();
let loaded = false;

async function tryLoad(alias: string, src: string): Promise<void> {
  try {
    const tex = await Assets.load<Texture>({ alias, src });
    if (tex) textures.set(alias, tex);
  } catch {
    missing.add(alias);
  }
}

export async function loadGameAssets(): Promise<{ found: number; missing: string[] }> {
  if (loaded) return { found: textures.size, missing: [...missing] };
  const entries = allAssetEntries();
  await Promise.allSettled(entries.map((e) => tryLoad(e.alias, e.src)));
  loaded = true;
  if (missing.size > 0 && process.env.NODE_ENV === 'development') {
    console.info(
      `[sugu-assets] ${textures.size} imágenes cargadas, ${missing.size} pendientes ` +
        `(se dibujan con fallback procedural). Faltan:\n  ` +
        [...missing].join('\n  ')
    );
  }
  return { found: textures.size, missing: [...missing] };
}

export function getTexture(group: AssetGroup, name: string): Texture | null {
  return textures.get(`${group}/${name}`) ?? null;
}

export function hasTexture(group: AssetGroup, name: string): boolean {
  return textures.has(`${group}/${name}`);
}

/** Para usar en <img> de React sin pasar por Pixi. */
export function imageSrc(group: AssetGroup, name: string): string {
  return assetUrl(group, name);
}

export function resetAssetCache(): void {
  textures.clear();
  missing.clear();
  loaded = false;
}
