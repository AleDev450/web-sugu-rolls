/**
 * Constantes de Sugu Maki Maze. Todo lo que se toca para equilibrar el juego
 * vive aquí; ni el motor ni la interfaz llevan números sueltos.
 */

/** Rejilla de todos los mapas. Los 5 niveles comparten medidas. */
export const COLS = 21;
export const ROWS = 25;

/**
 * Lado de casilla en píxeles de DISEÑO. El tablero se compone siempre a
 * 504x600 y luego se escala entero para encajar en el canvas real, así que
 * este número no depende de la pantalla.
 */
export const TILE = 24;

export const BOARD_W = COLS * TILE;
export const BOARD_H = ROWS * TILE;

/** Velocidad base del jugador, en píxeles de diseño por segundo (~5,2 casillas/s). */
export const PLAYER_SPEED = 125;

/** Velocidad base de los enemigos. Cada personalidad y nivel la ajustan. */
export const ENEMY_SPEED = 108;

/** Multiplicadores de velocidad por estado del enemigo. */
export const ENEMY_SPEED_MULT = {
  scatter: 1,
  chase: 1,
  /** Asustados van claramente más lentos: es la ventana para cazarlos. */
  frightened: 0.62,
  /** Comidos vuelven disparados a la cocina. */
  eaten: 2.4,
} as const;

/** Duración del modo SUGU POWER (wasabi), en ms. */
export const POWER_MS = 7000;
/** Últimos milisegundos del power-up: los enemigos parpadean avisando. */
export const POWER_WARN_MS = 2000;

/** El gari acelera al jugador durante este tiempo. */
export const GARI_MS = 5000;
export const GARI_SPEED_MULT = 1.28;

/** Puntos. */
export const PTS = {
  rice: 10,
  gari: 100,
  nigiri: 250,
  golden: 1000,
  levelComplete: 1500,
  /** Por cada segundo que sobre en el reloj al completar el nivel. */
  perSecondLeft: 10,
  /** Cadena de enemigos comidos dentro del mismo wasabi. */
  enemyChain: [200, 400, 800, 1600],
} as const;

/** Segundos de partida por nivel. A partir del 5 se repite el último. */
export const LEVEL_SECONDS = [120, 110, 100, 90, 80];

/** Por debajo de estos segundos el reloj parpadea y sube la tensión. */
export const TIME_WARNING_S = 15;

/** Ventana del combo: si pasa este tiempo sin recoger nada, se corta. */
export const COMBO_MS = 2000;
/** Recogidas seguidas que hacen falta para subir un escalón de combo. */
export const COMBO_STEP = 8;
/**
 * Tope del multiplicador. Es bajo a propósito: el combo tiene que premiar una
 * carrera limpia, no convertir un pasillo largo de arroz en miles de puntos.
 */
export const COMBO_MAX = 4;

/** El maki dorado aparece una vez por nivel y dura esto. */
export const GOLDEN_MS = 8000;
/** Se asoma cuando quedan estas fracciones de arroz por recoger. */
export const GOLDEN_TRIGGER_RATIO = 0.55;

/** Pausa tras perder una vida, antes de recolocar a todos. */
export const DEATH_PAUSE_MS = 1200;
/** Cartel de NIVEL COMPLETADO. */
export const LEVEL_COMPLETE_MS = 1500;

export const START_LIVES = 3;

/** Alternancia scatter/chase, en ms. Se repite el último tramo. */
export const MODE_CYCLE_MS = [7000, 20000, 7000, 20000, 5000, 20000];

/** Cada cuánto recalcula la ruta cada personalidad (ms). */
export const REPATH_MS = {
  chili: 260,
  wasabi: 340,
  ebi: 480,
  sauce: 400,
} as const;

/** Radio de choque jugador-enemigo, en píxeles de diseño. */
export const HIT_RADIUS = TILE * 0.62;

/** Récords y logros. */
export const HIGHSCORE_KEY = 'sugu-maki-maze-highscore';
export const CROWN_SCORE = 10000;
export const MASTER_SCORE = 25000;

/**
 * A partir del nivel 6 se reutilizan los mapas y sube la dificultad. Estos son
 * los incrementos por vuelta (nivel 6 = vuelta 1, nivel 11 = vuelta 2...).
 */
export const LOOP_ENEMY_SPEED = 9;
export const LOOP_PLAYER_SPEED = 3;
/** Los tramos scatter/chase se acortan un 12% por vuelta. */
export const LOOP_CYCLE_SHRINK = 0.88;

/**
 * Vista de depuración: rejilla, hitboxes, spawns y la ruta que sigue cada
 * enemigo. También se activa con `?debug` en la URL.
 */
export const DEBUG_GAME = false;
