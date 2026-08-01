/**
 * Manifest de imágenes.
 *
 * Fuente de verdad: la carpeta `/imagenes` en la raíz del proyecto.
 * `npm run assets:sync` la copia a `/public/imagenes` (se ejecuta solo en
 * predev y prebuild). Para cambiar un sprite basta con reemplazar el archivo
 * en `/imagenes` con el mismo nombre — no hay que tocar código.
 *
 * 2026-07-31: assets reducidos al mínimo que usa el juego (comidas, vidrio,
 * barra HUD y fondo). Todo en WebP para bajar peso. Las fuentes de trabajo
 * viven en /imagenes/_fuentes y no se publican.
 *
 * Toda imagen que falte se sustituye por el dibujo procedural del fallback,
 * así el juego corre completo aunque la carpeta esté vacía.
 */

export const ASSET_BASE = '/imagenes';

/** Cadena de evolución — /imagenes/sushi/*.webp (generados por prepare-food) */
export const SUSHI_SPRITES = [
  '01-onigiri',
  '02-gyoza',
  '03-hosomaki',
  '04-temaki',
  '05-ebi-roll',
  '06-pokebowl',
  '07-dragon-roll',
  '08-acevichado-roll',
  '09-sugu-especial',
  '10-sugu-supreme',
] as const;

/** Chrome de interfaz — /imagenes/ui/*.webp */
export const UI_SPRITES = [
  'marco-hud',
  'vidrio',
  'vista-principal',
  'ventana-emergente',
  'game-over',
  'how-to-play-1',
  'how-to-play-2',
  'ventana-pausa',
  'ajustes',
  'ranking',
] as const;

/** Fondo único — /imagenes/fondos/background.webp */
export const BG_SPRITES = ['background'] as const;

/** Clientes VIP — /imagenes/bt21/*.webp (generados por prepare-bt21) */
export const BT21_SPRITES = [
  'koya',
  'rj',
  'shooky',
  'mang',
  'chimmy',
  'tata',
  'cooky',
  'van',
] as const;

export type AssetGroup = 'sushi' | 'ui' | 'fondos' | 'bt21';

export function assetUrl(group: AssetGroup, name: string): string {
  // hoy todos los assets publicados van en WebP
  return `${ASSET_BASE}/${group}/${name}.webp`;
}

/** Lista plana de todo lo que intentamos precargar. */
export function allAssetEntries(): { alias: string; src: string }[] {
  const entries: { alias: string; src: string }[] = [];
  const push = (group: AssetGroup, names: readonly string[]) => {
    for (const n of names) entries.push({ alias: `${group}/${n}`, src: assetUrl(group, n) });
  };
  push('sushi', SUSHI_SPRITES);
  push('ui', UI_SPRITES);
  push('fondos', BG_SPRITES);
  push('bt21', BT21_SPRITES);
  return entries;
}
