import type { LevelConfig } from '../types';

/**
 * Niveles de Sugu Match.
 *
 * Un nivel es un objeto, no código: añadir contenido nuevo NO debería tocar el
 * motor. Si un nivel necesita algo que no se puede expresar aquí, lo que hay
 * que ampliar es `LevelConfig`, no `Game.ts`.
 *
 * Leyenda de `layout` (una cadena por fila, un carácter por columna):
 *
 *   .  casilla normal
 *   #  hueco: no hay casilla, nada cae ni se genera aquí
 *   o  piedra: obstáculo fijo, no se empareja ni cae
 *   i  hielo: la pieza necesita un match para liberarse
 *   I  hielo doble: dos matches
 *   c  cuerda: la pieza no se puede intercambiar hasta romperla
 *
 * Si `layout` no está, el tablero es rectangular y limpio.
 *
 * CUIDADO con los objetivos de tipo 'break': el hielo y la cuerda no vuelven a
 * salir una vez rotos, así que pedir más de los que hay en el `layout` deja el
 * nivel imposible. Cuéntalos antes de tocar la cifra.
 */

export const LEVELS: readonly LevelConfig[] = [
  {
    id: 1,
    nombre: 'Primer bocado',
    rows: 8,
    cols: 8,
    moves: 25,
    tiles: ['poke', 'ikura', 'onigiri', 'temaki', 'gyoza', 'maki'],
    objectives: [
      { type: 'collect', tile: 'onigiri', amount: 20 },
      { type: 'collect', tile: 'maki', amount: 15 },
    ],
    stars: { one: 5000, two: 10000, three: 15000 },
    boosters: { shoyu: 3, ohashi: 3, gari: 2, wasabi: 2, spicy: 2, shuffle: 1, clock: 1 },
  },
  {
    id: 2,
    nombre: 'Barra llena',
    rows: 8,
    cols: 8,
    moves: 23,
    tiles: ['poke', 'ikura', 'onigiri', 'temaki', 'gyoza', 'maki'],
    objectives: [
      { type: 'collect', tile: 'poke', amount: 18 },
      { type: 'collect', tile: 'ikura', amount: 12 },
      { type: 'collect', tile: 'onigiri', amount: 20 },
    ],
    stars: { one: 6000, two: 12000, three: 18000 },
    boosters: { shoyu: 3, ohashi: 2, gari: 2, wasabi: 2, spicy: 2, shuffle: 1, clock: 1 },
  },
  {
    id: 3,
    nombre: 'Hielo en la nevera',
    rows: 8,
    cols: 8,
    moves: 26,
    tiles: ['poke', 'ikura', 'onigiri', 'temaki', 'gyoza', 'maki'],
    objectives: [
      { type: 'break', layer: 'ice', amount: 12 },
      { type: 'collect', tile: 'temaki', amount: 16 },
    ],
    stars: { one: 7000, two: 13000, three: 19000 },
    layout: [
      '........',
      '..iiii..',
      '..i..i..',
      '........',
      '........',
      '..i..i..',
      '..iiii..',
      '........',
    ],
    boosters: { shoyu: 3, ohashi: 2, gari: 2, wasabi: 2, spicy: 2, shuffle: 1, clock: 1 },
  },
  {
    id: 4,
    nombre: 'Piedras en el pasillo',
    rows: 9,
    cols: 9,
    moves: 28,
    tiles: ['poke', 'ikura', 'onigiri', 'temaki', 'gyoza', 'maki'],
    objectives: [
      { type: 'collect', tile: 'gyoza', amount: 22 },
      // el layout trae exactamente 6 cuerdas, y no reaparecen
      { type: 'break', layer: 'rope', amount: 6 },
    ],
    stars: { one: 8000, two: 15000, three: 22000 },
    layout: [
      '.........',
      '...ccc...',
      '..o...o..',
      '.........',
      '....o....',
      '.........',
      '..o...o..',
      '...ccc...',
      '.........',
    ],
    boosters: { shoyu: 3, ohashi: 3, gari: 2, wasabi: 2, spicy: 2, shuffle: 1, clock: 1 },
  },
  {
    id: 5,
    nombre: 'Sugu Supreme',
    rows: 9,
    cols: 9,
    moves: 30,
    tiles: ['poke', 'ikura', 'onigiri', 'temaki', 'gyoza', 'maki'],
    objectives: [
      { type: 'collect', tile: 'maki', amount: 30 },
      { type: 'collect', tile: 'ikura', amount: 25 },
      { type: 'break', layer: 'ice', amount: 10 },
    ],
    stars: { one: 10000, two: 18000, three: 26000 },
    layout: [
      '##.....##',
      '#..III..#',
      '...o.o...',
      '.I..o..I.',
      '..o...o..',
      '.I..o..I.',
      '...o.o...',
      '#..III..#',
      '##.....##',
    ],
    boosters: { shoyu: 4, ohashi: 3, gari: 3, wasabi: 3, spicy: 2, shuffle: 2, clock: 2 },
  },
];

export function nivel(id: number): LevelConfig {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

export const ULTIMO_NIVEL = LEVELS[LEVELS.length - 1].id;
