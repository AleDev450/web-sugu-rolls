import { LEVEL_SECONDS, LOOP_ENEMY_SPEED, LOOP_PLAYER_SPEED, LOOP_CYCLE_SHRINK, MODE_CYCLE_MS, ENEMY_SPEED, PLAYER_SPEED } from './config';
import type { EnemyKind } from './types';

/**
 * Los cinco laberintos de Sugu Maki Maze.
 *
 * Todos miden 21x25 y son simétricos respecto de la columna central, como los
 * salones recreativos de los 80: el ojo lee antes un mapa simétrico y el
 * jugador memoriza la mitad y sabe la otra.
 *
 * Leyenda:
 *   #   pared
 *   .   arroz (10 pts)
 *   ' ' suelo sin arroz
 *   P   posición inicial del jugador
 *   1-4 posición inicial de cada enemigo (dentro de la cocina)
 *   -   puerta de la cocina: la cruzan los enemigos, no el jugador
 *   W   wasabi (power-up SUGU POWER)
 *   N   nigiri (250 pts)
 *   R   gari (100 pts + velocidad)
 *   B   punto donde asoma el maki dorado
 *   T   túnel: al salir por un borde se aparece en el opuesto
 *
 * La "cocina" (filas 10-14, columnas 7-13) es idéntica en los cinco mapas a
 * propósito: los enemigos siempre salen por el mismo sitio, así que el jugador
 * puede confiar en lo aprendido aunque cambie el laberinto de alrededor.
 */

/** Nivel 1 — pasillos anchos, pocos callejones. Para aprender a girar. */
const MAPA_1 = [
  '#####################',
  '#...................#',
  '#.###.###.#.###.###.#',
  '#W#.....#.#.#.....#W#',
  '#.#.###.#.#.#.###.#.#',
  '#...#N....#....N#...#',
  '#.#.#.###.#.###.#.#.#',
  '#...................#',
  '#.###.##.#.#.##.###.#',
  '#...#...#...#...#...#',
  '#.#.#.####-####.#.#.#',
  'T...#.##     ##.#...T',
  '#.#.#.##1 2 3##.#.#.#',
  '#.#.#.##  4  ##.#.#.#',
  '#.#.#.#########.#.#.#',
  '#.........B.........#',
  '#.###.##.#.#.##.###.#',
  '#.#R......#......R#.#',
  '#.#.###.#.#.#.###.#.#',
  '#W..#...#.#.#...#..W#',
  '#.#.#.#.#####.#.#.#.#',
  '#...................#',
  '#.###.####.####.###.#',
  '#.........P.........#',
  '#####################',
];

/** Nivel 2 — anillo exterior completo y un túnel a media altura. */
const MAPA_2 = [
  '#####################',
  '#.........#.........#',
  '#.#######.#.#######.#',
  '#W.................W#',
  '#.###.###.#.###.###.#',
  '#N..#...#.#.#...#..N#',
  '###.#.#.#####.#.#.###',
  'T.........#.........T',
  '#.###.##.#.#.##.###.#',
  '#.#...............#.#',
  '#.#.#.####-####.#.#.#',
  '#...#.##     ##.#...#',
  '#.#.#.##1 2 3##.#.#.#',
  '#.#.#.##  4  ##.#.#.#',
  '#.#.#.#########.#.#.#',
  '#...#.....B.....#...#',
  '#.#.#.###.#.###.#.#.#',
  '#.#.......#.......#.#',
  '#.#####.#.#.#.#####.#',
  '#W........#........W#',
  '#.###.###.#.###.###.#',
  '#R..#...........#..R#',
  '#.#.#..#######..#.#.#',
  '#.........P.........#',
  '#####################',
];

/** Nivel 3 — celdas pequeñas y cruces cortos: se gira todo el rato. */
const MAPA_3 = [
  '#####################',
  '#....#....#....#....#',
  '#.##.#.##.#.##.#.##.#',
  '#W.................W#',
  '###.###.#####.###.###',
  '#N....#.......#....N#',
  '#.#####.#.#.#.#####.#',
  '#.#.R.#.#.#.#.#.R.#.#',
  '#.#.#.#.#.#.#.#.#.#.#',
  '#...#.#...#...#.#...#',
  '#.#.#.####-####.#.#.#',
  'T...#.##     ##.#...T',
  '#.#.#.##1 2 3##.#.#.#',
  '#.#.#.##  4  ##.#.#.#',
  '#.#.#.#########.#.#.#',
  '#.........B.........#',
  '#.###.###.#.###.###.#',
  '#...#...#...#...#...#',
  '#.#.#.#.#.#.#.#.#.#.#',
  '#.#...#.......#...#.#',
  '#.#.#####.#.#####.#.#',
  '#W........#........W#',
  '#.#######.#.#######.#',
  '#.........P.........#',
  '#####################',
];

/** Nivel 4 — bucles largos por fuera, embudos por dentro. */
const MAPA_4 = [
  '#####################',
  '#...................#',
  '#.###.#.#####.#.###.#',
  '#N..#.#.......#.#..N#',
  '###.#.#.#####.#.#.###',
  '#...#.#.#...#.#.#...#',
  '#.#.#.#.#.#.#.#.#.#.#',
  '#W#...#...#...#...#W#',
  '#.#.#####.#.#####.#.#',
  '#...................#',
  '#.#.#.####-####.#.#.#',
  'T...#.##     ##.#...T',
  '#.#.#.##1 2 3##.#.#.#',
  '#.#.#.##  4  ##.#.#.#',
  '#.#.#.#########.#.#.#',
  '#.........B.........#',
  '#.#####.#####.#####.#',
  '#...#.....#.....#...#',
  '#.#.#.###.#.###.#.#.#',
  '#.#.R.....#.....R.#.#',
  '#.#.#####.#.#####.#.#',
  '#W......#.#.#......W#',
  '#.####.#######.####.#',
  '#.........P.........#',
  '#####################',
];

/** Nivel 5 — el más cerrado: dos túneles y cruces cada dos casillas. */
const MAPA_5 = [
  '#####################',
  '#W...#.........#...W#',
  '#.##.#.#######.#.##.#',
  '#...#...........#...#',
  '#.#.#.#.#.#.#.#.#.#.#',
  '#.#N......#......N#.#',
  '#.#.#####.#.#####.#.#',
  'T.........#.........T',
  '#.###.###.#.###.###.#',
  '#...#...#...#...#...#',
  '#.#.#.####-####.#.#.#',
  '#...#.##     ##.#...#',
  '#.#.#.##1 2 3##.#.#.#',
  '#.#.#.##  4  ##.#.#.#',
  '#.#.#.#########.#.#.#',
  '#...#.....B.....#...#',
  '#.#.#.#.#.#.#.#.#.#.#',
  '#.#.#.#R.....R#.#.#.#',
  '#.#.#####.#.#####.#.#',
  'T.........#.........T',
  '#.#######.#.#######.#',
  '#W.................W#',
  '#.###.#########.###.#',
  '#.........P.........#',
  '#####################',
];

export const MAPS: readonly string[][] = [MAPA_1, MAPA_2, MAPA_3, MAPA_4, MAPA_5];

/** Reparto de enemigos por nivel: se van sumando personalidades. */
const ENEMIGOS_POR_NIVEL: readonly EnemyKind[][] = [
  ['chili', 'wasabi'],
  ['chili', 'wasabi', 'ebi'],
  ['chili', 'wasabi', 'ebi', 'sauce'],
  ['chili', 'wasabi', 'ebi', 'sauce'],
  ['chili', 'wasabi', 'ebi', 'sauce'],
];

export interface LevelConfig {
  /** 1, 2, 3... sin techo. */
  level: number;
  /** Índice del mapa (0-4). A partir del nivel 6 se reciclan. */
  mapIndex: number;
  map: readonly string[];
  seconds: number;
  enemies: readonly EnemyKind[];
  playerSpeed: number;
  enemySpeed: number;
  /** Tramos scatter/chase, ya acortados por la vuelta que toque. */
  modeCycle: readonly number[];
  /** Vuelta 0 = niveles 1-5, vuelta 1 = 6-10... */
  loop: number;
}

/**
 * Devuelve la configuración de un nivel. Del 1 al 5 son los mapas tal cual;
 * del 6 en adelante se repiten los mismos laberintos pero cada vuelta sube la
 * velocidad de todos y acorta los relevos scatter/chase, así que el mismo
 * trazado se juega distinto.
 */
export function getLevelConfig(level: number): LevelConfig {
  const index = (level - 1) % MAPS.length;
  const loop = Math.floor((level - 1) / MAPS.length);

  return {
    level,
    mapIndex: index,
    map: MAPS[index],
    seconds: LEVEL_SECONDS[index],
    enemies: ENEMIGOS_POR_NIVEL[index],
    playerSpeed: PLAYER_SPEED + loop * LOOP_PLAYER_SPEED,
    /*
     * El nivel 4 y el 5 ya llevan enemigos más rápidos dentro de la primera
     * vuelta: el mapa se repite del 1 al 3, así que la subida tiene que venir
     * del propio índice, no solo de la vuelta.
     */
    enemySpeed: ENEMY_SPEED + index * 4 + loop * LOOP_ENEMY_SPEED,
    modeCycle: MODE_CYCLE_MS.map((ms) => Math.round(ms * LOOP_CYCLE_SHRINK ** loop)),
    loop,
  };
}
