/**
 * Cadena de evolución — 10 niveles, tal cual el boceto.
 *
 * `radius` está en unidades de diseño (el tablero mide DESIGN.board.w = 380).
 * El renderer escala todo por un único factor, así que estos números no cambian
 * aunque cambie el tamaño de pantalla.
 *
 * 2026-07-31: radios subidos ~22% (los productos se veían muy pequeños).
 * Para agrandar/achicar más, tocar solo estos números.
 *
 * `sprite` apunta a una clave del manifest de assets. Mientras la imagen no
 * exista, el renderer dibuja el fallback procedural con `palette`.
 */

export type TierKind =
  | 'onigiri'
  | 'gyoza'
  | 'maki'
  | 'futomaki'
  | 'roll'
  | 'california'
  | 'dragon'
  | 'acevichado'
  | 'especial'
  | 'supreme';

export interface Tier {
  /** índice 0-based, coincide con la posición en TIERS */
  index: number;
  /** id estable para persistencia / analytics — nunca renombrar */
  id: string;
  name: string;
  kind: TierKind;
  /** radio del cuerpo físico, en unidades de diseño */
  radius: number;
  /** puntos que otorga CREAR esta pieza al fusionar */
  points: number;
  /** clave en ASSETS.sushi */
  sprite: string;
  /** colores del fallback procedural (mientras no hay imagen) */
  palette: {
    base: string;
    accent: string;
    wrap?: string;
    fill?: string;
  };
}

export const TIERS: Tier[] = [
  {
    index: 0,
    id: 'onigiri',
    name: 'Onigiri',
    kind: 'onigiri',
    radius: 20,
    points: 10,
    sprite: '01-onigiri',
    palette: { base: '#fbf6ec', accent: '#e9dcc4', wrap: '#2b3540' },
  },
  {
    index: 1,
    id: 'gyoza',
    name: 'Gyoza',
    kind: 'gyoza',
    radius: 26,
    points: 30,
    sprite: '02-gyoza',
    palette: { base: '#f3e6c8', accent: '#dcc79b', wrap: '#c9ad7c' },
  },
  {
    index: 2,
    id: 'hosomaki',
    name: 'Hosomaki',
    kind: 'maki',
    radius: 33,
    points: 60,
    sprite: '03-hosomaki',
    palette: { base: '#1a2129', accent: '#8bb04a', fill: '#8bb04a' },
  },
  {
    // 2026-07-31: Temaki reemplaza a Futomaki (nuevo set de comidas).
    // `kind` sigue siendo 'futomaki' solo para el dibujo de respaldo.
    index: 3,
    id: 'temaki',
    name: 'Temaki',
    kind: 'futomaki',
    radius: 42,
    points: 100,
    sprite: '04-temaki',
    palette: { base: '#1a2129', accent: '#f2c14e', fill: '#f2c14e' },
  },
  {
    index: 4,
    id: 'ebi-roll',
    name: 'Ebi Roll',
    kind: 'roll',
    radius: 50,
    points: 150,
    sprite: '05-ebi-roll',
    palette: { base: '#fbf6ec', accent: '#f4956b', fill: '#f4956b' },
  },
  {
    // 2026-07-31: Poke Bowl reemplaza a California Roll (nuevo set de comidas).
    index: 5,
    id: 'pokebowl',
    name: 'Poke Bowl',
    kind: 'california',
    radius: 60,
    points: 210,
    sprite: '06-pokebowl',
    palette: { base: '#fbf6ec', accent: '#f4784f', wrap: '#e6c98f' },
  },
  {
    index: 6,
    id: 'dragon-roll',
    name: 'Dragon Roll',
    kind: 'dragon',
    radius: 71,
    points: 280,
    sprite: '07-dragon-roll',
    palette: { base: '#a4d07a', accent: '#8bb04a', wrap: '#7fae4f' },
  },
  {
    index: 7,
    id: 'acevichado-roll',
    name: 'Acevichado Roll',
    kind: 'acevichado',
    radius: 83,
    points: 360,
    sprite: '08-acevichado-roll',
    palette: { base: '#f4b06b', accent: '#f4784f', wrap: '#f2a84e' },
  },
  {
    index: 8,
    id: 'sugu-especial',
    name: 'Sugu Especial',
    kind: 'especial',
    radius: 96,
    points: 450,
    sprite: '09-sugu-especial',
    palette: { base: '#f7d9a0', accent: '#f4784f', wrap: '#e8a04f' },
  },
  {
    index: 9,
    id: 'sugu-supreme',
    name: 'Sugu Supreme',
    kind: 'supreme',
    radius: 110,
    points: 550,
    sprite: '10-sugu-supreme',
    palette: { base: '#f2c14e', accent: '#f4784f', wrap: '#d99b28' },
  },
];

export const MAX_TIER = TIERS.length - 1;

/** Solo los primeros tiers caen desde arriba. */
export const SPAWN_MAX_TIER = 3;
export const SPAWN_WEIGHTS = [34, 28, 22, 16];

export function rollSpawnTier(
  rand: () => number = Math.random,
  weights: readonly number[] = SPAWN_WEIGHTS
): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i <= SPAWN_MAX_TIER; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

export function tierAt(index: number): Tier {
  return TIERS[Math.max(0, Math.min(MAX_TIER, index))];
}
