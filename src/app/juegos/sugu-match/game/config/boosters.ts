import type { BoosterId, BoosterTarget } from '../types';

/**
 * Boosters de Sugu Match.
 *
 * Cada uno declara qué necesita del jugador (`target`) y qué hace. La lógica
 * vive en `core/boosters.ts`; esto es solo el catálogo que leen la barra de
 * boosters y el motor.
 *
 * `gastaMovimiento` está pensado para el futuro: hoy ningún booster cobra
 * movimiento, pero la regla ya es un dato y no una constante escondida.
 */

export interface BoosterDef {
  id: BoosterId;
  nombre: string;
  descripcion: string;
  /** Clave del atlas (`render/sprites.ts`). */
  frame: string;
  /** Emoji de respaldo mientras no esté el sprite sheet. */
  emoji: string;
  color: string;
  /**
   * 'tile' pide tocar una pieza, 'swap' pide tocar dos, 'none' actúa al
   * instante sobre todo el tablero.
   */
  target: BoosterTarget;
  gastaMovimiento: boolean;
}

export const BOOSTERS: Record<BoosterId, BoosterDef> = {
  shoyu: {
    id: 'shoyu',
    nombre: 'Shoyu',
    descripcion: 'Elimina la pieza que toques.',
    frame: 'booster.shoyu',
    emoji: '\u{1F376}',
    color: '#6b3f1d',
    target: 'tile',
    gastaMovimiento: false,
  },
  ohashi: {
    id: 'ohashi',
    nombre: 'Ohashi',
    descripcion: 'Intercambia dos piezas vecinas aunque no formen match.',
    frame: 'booster.ohashi',
    emoji: '\u{1F962}',
    color: '#c8912f',
    target: 'swap',
    gastaMovimiento: false,
  },
  spicy: {
    id: 'spicy',
    nombre: 'Aji',
    descripcion: 'Explosion de 3x3 alrededor de la pieza.',
    frame: 'booster.spicy',
    emoji: '\u{1F336}',
    color: '#e03b2f',
    target: 'tile',
    gastaMovimiento: false,
  },
  gari: {
    id: 'gari',
    nombre: 'Gari',
    descripcion: 'Barre la fila completa.',
    frame: 'booster.gari',
    emoji: '\u{1F338}',
    color: '#f4a1b6',
    target: 'tile',
    gastaMovimiento: false,
  },
  wasabi: {
    id: 'wasabi',
    nombre: 'Wasabi',
    descripcion: 'Barre la columna completa.',
    frame: 'booster.wasabi',
    emoji: '\u{1F7E2}',
    color: '#7fbf3f',
    target: 'tile',
    gastaMovimiento: false,
  },
  shuffle: {
    id: 'shuffle',
    nombre: 'Shuffle',
    descripcion: 'Mezcla todas las piezas del tablero.',
    frame: 'booster.shuffle',
    emoji: '\u{1F504}',
    color: '#8d6ef0',
    target: 'none',
    gastaMovimiento: false,
  },
  clock: {
    id: 'clock',
    nombre: 'Reloj',
    descripcion: 'Suma 5 movimientos.',
    frame: 'booster.clock',
    emoji: '\u{23F1}',
    color: '#ef7aa8',
    target: 'none',
    gastaMovimiento: false,
  },
};

/** Orden en el que se pintan en la barra inferior. */
export const ORDEN_BOOSTERS: readonly BoosterId[] = [
  'shoyu',
  'ohashi',
  'gari',
  'wasabi',
  'spicy',
  'shuffle',
  'clock',
];

/** Movimientos que regala el reloj. */
export const MOVIMIENTOS_RELOJ = 5;

/** Inventario de arranque mientras no haya cuenta ni Supabase detras. */
export const INVENTARIO_INICIAL: Record<BoosterId, number> = {
  shoyu: 3,
  ohashi: 3,
  gari: 2,
  wasabi: 2,
  spicy: 2,
  shuffle: 1,
  clock: 1,
};
