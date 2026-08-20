import type { MatchType, TileType } from '../types';

/**
 * Catálogo de piezas de Sugu Match.
 *
 * Cada pieza declara su frame del sprite sheet y un color. El color NO es
 * decorativo: lo usan las partículas, el resplandor de los especiales y el
 * dibujo de repuesto cuando el PNG todavía no está en /public. Tener un tono
 * propio por pieza es además lo que hace legible un Match-3 de un vistazo.
 */

export interface TileDef {
  type: MatchType;
  /** Nombre visible en objetivos y avisos. */
  nombre: string;
  /** Clave del atlas (`render/sprites.ts`). */
  frame: string;
  /** Tono principal, para partículas y respaldo procedural. */
  color: number;
  /** Tono secundario (relleno, topping). */
  colorAlt: number;
  /** Respaldo para el HUD del DOM mientras no esté el sprite sheet. */
  emoji: string;
}

export const TILES: Record<MatchType, TileDef> = {
  poke: {
    type: 'poke',
    nombre: 'Poke Bowl',
    frame: 'tile.poke',
    color: 0xff8a3d,
    colorAlt: 0x2b2b2b,
    emoji: '🍛',
  },
  ikura: {
    type: 'ikura',
    nombre: 'Ikura',
    frame: 'tile.ikura',
    color: 0xff5a2c,
    colorAlt: 0xfff3e0,
    emoji: '🍣',
  },
  onigiri: {
    type: 'onigiri',
    nombre: 'Onigiri',
    frame: 'tile.onigiri',
    color: 0xf7f1e3,
    colorAlt: 0x1f3d2b,
    emoji: '🍙',
  },
  temaki: {
    type: 'temaki',
    nombre: 'Temaki',
    frame: 'tile.temaki',
    color: 0x1f3d2b,
    colorAlt: 0xff8a5c,
    emoji: '🌯',
  },
  gyoza: {
    type: 'gyoza',
    nombre: 'Gyoza',
    frame: 'tile.gyoza',
    color: 0xf3ddb3,
    colorAlt: 0xd9b380,
    emoji: '🥟',
  },
  maki: {
    type: 'maki',
    nombre: 'Maki',
    frame: 'tile.maki',
    color: 0x2f5d3a,
    colorAlt: 0x6fbf5b,
    emoji: '🍥',
  },
};

/** Obstáculo sólido: ni se empareja ni cae. */
export const PIEDRA = {
  nombre: 'Piedra',
  frame: 'obstacle.stone',
  color: 0x3a3a42,
  colorAlt: 0x1b1b20,
} as const;

export function tileColor(t: TileType): number {
  return t === 'stone' ? PIEDRA.color : TILES[t].color;
}

export function tileNombre(t: TileType): string {
  return t === 'stone' ? PIEDRA.nombre : TILES[t].nombre;
}

export function tileFrame(t: TileType): string {
  return t === 'stone' ? PIEDRA.frame : TILES[t].frame;
}

export function tileEmoji(t: TileType): string {
  return t === 'stone' ? '\u{1FAA8}' : TILES[t].emoji;
}

/** Frames de los especiales y de las cubiertas. */
export const SPECIAL_FRAMES = {
  rainbow: 'special.rainbow',
  bomb: 'special.wrapped',
  ice: 'layer.ice',
  rope: 'layer.rope',
} as const;
