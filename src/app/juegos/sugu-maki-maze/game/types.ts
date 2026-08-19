/** Tipos compartidos por el motor, el store y la interfaz. */

export type GameStatus =
  | 'menu'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'level-complete'
  | 'game-over';

/** Direcciones. Los valores son los del vector, para no repetir tablas. */
export const DIRS = {
  none: { x: 0, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const;

export type Dir = keyof typeof DIRS;

/** Las cuatro direcciones reales, en el orden de desempate de la IA. */
export const DIR_LIST: readonly Dir[] = ['up', 'left', 'down', 'right'];

export function opuesta(d: Dir): Dir {
  if (d === 'up') return 'down';
  if (d === 'down') return 'up';
  if (d === 'left') return 'right';
  if (d === 'right') return 'left';
  return 'none';
}

export type ItemKind = 'rice' | 'nigiri' | 'gari' | 'wasabi' | 'golden';

export type EnemyKind = 'chili' | 'wasabi' | 'ebi' | 'sauce';

export type EnemyMode = 'scatter' | 'chase' | 'frightened' | 'eaten';

export interface Tile {
  x: number;
  y: number;
}

/** Resumen de la partida que se guarda al terminar. */
export interface GameResult {
  score: number;
  level: number;
  /** Duración total en milisegundos. */
  duration: number;
  collectedItems: Record<ItemKind, number>;
  enemiesEaten: number;
}
