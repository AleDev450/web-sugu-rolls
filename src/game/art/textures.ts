import { Texture } from 'pixi.js';
import { getTexture } from '@/game/assets/loader';
import { TIERS } from '@/game/config/tiers';
import { renderTierCanvas } from './procedural';

/**
 * Resuelve la textura de un tier: PNG real si existe en /imagenes/sushi,
 * si no el placeholder procedural (generado una sola vez y cacheado).
 */

/** El placeholder se genera a 3x el radio de diseño para que aguante el zoom. */
const PROC_RES = 3;

const procCache = new Map<number, Texture>();

export function getTierTexture(tierIndex: number): Texture {
  const tier = TIERS[tierIndex];
  const real = getTexture('sushi', tier.sprite);
  if (real) return real;

  const cached = procCache.get(tierIndex);
  if (cached) return cached;

  const canvas = renderTierCanvas(tierIndex, tier.radius * PROC_RES);
  const tex = Texture.from(canvas);
  procCache.set(tierIndex, tex);
  return tex;
}

/** ¿Estamos usando arte definitivo para este tier? Útil para el panel de debug. */
export function isRealArt(tierIndex: number): boolean {
  return getTexture('sushi', TIERS[tierIndex].sprite) !== null;
}

export function clearTextureCache(): void {
  for (const t of procCache.values()) t.destroy(true);
  procCache.clear();
}
