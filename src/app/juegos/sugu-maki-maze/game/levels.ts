import {
  CHASE_MULT,
  ENEMY_SPEED,
  ENEMY_SPEED_MAX,
  ENEMY_SPEED_STEP,
  LEVEL_SECONDS,
  LOOP_CYCLE_SHRINK,
  LOOP_PLAYER_SPEED,
  MODE_CYCLE_MS,
  PLAYER_SPEED,
  POWER_MS_POR_NIVEL,
  SCATTER_MULT,
} from './config';
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
 *   S   shoyu (300 pts + unos segundos a doble puntuación)
 *   O   ohashi (400 pts + unos segundos recogiendo arroz a distancia)
 *   H   corazón (una vida más; si ya están al tope, 750 pts)
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
  '#.........S.........#',
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
  '#.........O.........#',
  '#.###.####.####.###.#',
  '#.........P.........#',
  '#####################',
];

/** Nivel 2 — anillo exterior completo y un túnel a media altura. */
const MAPA_2 = [
  '#####################',
  '#.........#.........#',
  '#.#######.#.#######.#',
  '#W........S........W#',
  '#.###.###.#.###.###.#',
  '#N..#...#.#.#...#..N#',
  '###.#.#.#####.#.#.###',
  'T.........#.........T',
  '#.###.##.#.#.##.###.#',
  '#.#.......O.......#.#',
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
  '#W........S........W#',
  '###.###.#####.###.###',
  '#N....#...H...#....N#',
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
  '#...#...#.O.#...#...#',
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
  '#.........S.........#',
  '#.###.#.#####.#.###.#',
  '#N..#.#.......#.#..N#',
  '###.#.#.#####.#.#.###',
  '#...#.#.#...#.#.#...#',
  '#.#.#.#.#.#.#.#.#.#.#',
  '#W#...#...#...#...#W#',
  '#.#.#####.#.#####.#.#',
  '#.........O.........#',
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
  '#...#.....S.....#...#',
  '#.#.#.#.#.#.#.#.#.#.#',
  '#.#N......#......N#.#',
  '#.#.#####.#.#####.#.#',
  'T.........#.........T',
  '#.###.###.#.###.###.#',
  '#...#...#.H.#...#...#',
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
  '#W........O........W#',
  '#.###.#########.###.#',
  '#.........P.........#',
  '#####################',
];

export const MAPS: readonly string[][] = [MAPA_1, MAPA_2, MAPA_3, MAPA_4, MAPA_5];

/**
 * Reparto de enemigos por nivel: se van sumando personalidades de una en una.
 *
 * El primer nivel tiene UN enemigo. Con dos desde el principio el jugador
 * todavía no sabe por dónde salen ni cómo se mueven y ya está encerrado; con
 * uno se aprende el mapa, se prueba el wasabi y se llega al segundo sabiendo
 * jugar. Cada nivel presenta una persecución nueva.
 */
const ENEMIGOS_POR_NIVEL: readonly EnemyKind[][] = [
  ['chili'],
  ['chili', 'wasabi'],
  ['chili', 'wasabi', 'ebi'],
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
  /** Cuánto dura el SUGU POWER en este nivel, en ms. */
  powerMs: number;
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

  /*
   * La dificultad la marca el NIVEL, no el mapa.
   *
   * Es la diferencia que importa a partir del sexto: ahí se vuelve al primer
   * laberinto, y atándolo al índice del mapa se volvía también a un enemigo y
   * a la velocidad del principio. Después de haber ganado el nivel 5 con
   * cuatro persiguiéndote, eso es un escalón hacia abajo. Con el nivel como
   * referencia el mapa se repite pero la presión nunca baja.
   *
   * Del quinto en adelante se queda en el tope: cuatro enemigos, el ciclo
   * scatter/chase crudo y el power corto. Lo que sigue subiendo es la
   * velocidad.
   */
  const dificultad = Math.min(level - 1, ENEMIGOS_POR_NIVEL.length - 1);

  return {
    level,
    mapIndex: index,
    map: MAPS[index],
    // el reloj sí es cosa del mapa: depende de cuánto arroz hay que recorrer
    seconds: LEVEL_SECONDS[index],
    enemies: ENEMIGOS_POR_NIVEL[dificultad],
    powerMs: POWER_MS_POR_NIVEL[dificultad],
    playerSpeed: PLAYER_SPEED + loop * LOOP_PLAYER_SPEED,
    enemySpeed: Math.min(ENEMY_SPEED + (level - 1) * ENEMY_SPEED_STEP, ENEMY_SPEED_MAX),
    /*
     * Los tramos pares son scatter y los impares chase (lo decide la paridad
     * del índice en `modoDelCiclo`), así que el ajuste por nivel se aplica
     * según en qué posición caiga cada tramo.
     */
    modeCycle: MODE_CYCLE_MS.map((ms, i) => {
      const porNivel = i % 2 === 0 ? SCATTER_MULT[dificultad] : CHASE_MULT[dificultad];
      return Math.round(ms * porNivel * LOOP_CYCLE_SHRINK ** loop);
    }),
    loop,
  };
}
