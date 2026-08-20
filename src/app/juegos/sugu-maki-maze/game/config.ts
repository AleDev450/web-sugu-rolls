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

/**
 * Velocidad base de los enemigos, en el nivel 1. Cada personalidad y nivel la
 * ajustan.
 *
 * Está bastante por debajo de la del jugador a propósito: en el primer nivel se
 * corre un 30 % más que ellos y hay sitio para equivocarse. La ventaja se va
 * cerrando nivel a nivel (ver `ENEMY_SPEED_STEP`) hasta quedarse en un 8 % en
 * el quinto, que ya obliga a planear la ruta.
 */
export const ENEMY_SPEED = 96;

/** Lo que gana el enemigo por cada nivel. */
export const ENEMY_SPEED_STEP = 5;

/**
 * Techo de velocidad enemiga. El jugador va a 125 (+3 por vuelta), así que
 * este tope los deja rondándole sin llegar a ser imposible: por encima, en el
 * modo sin fin, no habría forma de escapar de un pasillo recto y la partida
 * dejaría de decidirse por jugar bien.
 */
export const ENEMY_SPEED_MAX = 134;

/** Multiplicadores de velocidad por estado del enemigo. */
export const ENEMY_SPEED_MULT = {
  scatter: 1,
  chase: 1,
  /** Asustados van claramente más lentos: es la ventana para cazarlos. */
  frightened: 0.62,
  /** Comidos vuelven disparados a la cocina. */
  eaten: 2.4,
} as const;

/**
 * Duración del modo SUGU POWER (wasabi), en ms, nivel a nivel. Empieza largo
 * —la ventana para cazar es lo que convierte el wasabi en puntos— y se acorta
 * conforme el jugador ya sabe aprovecharla.
 */
export const POWER_MS_POR_NIVEL = [9500, 9000, 8500, 8000, 7500];
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
  shoyu: 300,
  ohashi: 400,
  /** Corazón recogido con las vidas ya al tope: se cobra en puntos. */
  heart: 750,
  golden: 1000,
  levelComplete: 1500,
  /** Nivel terminado sin perder ninguna vida. */
  noDamage: 1000,
  /** Por cada segundo que sobre en el reloj al completar el nivel. */
  perSecondLeft: 10,
  /** Cadena de enemigos comidos dentro del mismo wasabi. */
  enemyChain: [200, 400, 800, 1600],
} as const;

/* --- objetos que dan puntos -------------------------------------------- */

/**
 * Shoyu: baño de salsa. Durante unos segundos TODO lo que se recoge vale el
 * doble, combo incluido. Es el objeto que premia haber dejado un pasillo largo
 * de arroz sin tocar para cuando aparezca.
 */
export const SHOYU_MS = 8000;
export const SHOYU_MULT = 2;

/**
 * Ohashi: los palillos alargan el brazo. Mientras duran, el arroz de las cuatro
 * casillas pegadas al maki se recoge solo, sin pasar por encima.
 *
 * El radio es 1 y no más: con 2,5 barría cinco filas de golpe, se limpiaban
 * pasillos enteros sin recorrerlos y el nivel se acababa solo. Un comecocos va
 * de elegir la ruta; los palillos dan un pellizco de ventaja, no un atajo.
 */
export const OHASHI_MS = 6000;
export const OHASHI_RADIO = 1;

/** Tope de vidas. El corazón por encima de esto se paga en puntos. */
export const MAX_LIVES = 5;

/**
 * Segundos de partida por nivel. A partir del 5 se repite el último.
 *
 * Recorrer un mapa entero cuesta unos 65 s jugando limpio, así que estos
 * números dejan de sobra para explorar, perder una vida y rehacer el camino.
 * El reloj no es la dificultad de este juego —esa la ponen los enemigos—: es
 * el que convierte el tiempo que sobra en puntos al cerrar el nivel.
 */
export const LEVEL_SECONDS = [130, 125, 120, 115, 110];

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

/**
 * Alternancia scatter/chase, en ms. Se repite el último tramo. Estos son los
 * tramos del NIVEL 5; los anteriores los estiran o los encogen con las dos
 * tablas de abajo.
 */
export const MODE_CYCLE_MS = [7000, 20000, 7000, 20000, 5000, 20000];

/**
 * Qué parte del ciclo pasan los enemigos a su aire (scatter) y qué parte
 * persiguiendo (chase), nivel a nivel.
 *
 * Aquí es donde de verdad se nota la dificultad. En el nivel 1 patrullan sus
 * esquinas más del doble de tiempo y persiguen la mitad, así que da margen a
 * aprenderse el mapa; en el 5 se quedan con los tramos crudos.
 */
export const SCATTER_MULT = [2.2, 1.7, 1.35, 1.15, 1];
export const CHASE_MULT = [0.5, 0.65, 0.8, 0.9, 1];

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
 * A partir del nivel 6 se reutilizan los mapas. La velocidad enemiga y los
 * enemigos en juego ya suben con el número de nivel, así que de la vuelta solo
 * cuelga lo que no depende de él.
 */
export const LOOP_PLAYER_SPEED = 3;
/** Los tramos scatter/chase se acortan un 12% por vuelta. */
export const LOOP_CYCLE_SHRINK = 0.88;

/**
 * Vista de depuración: rejilla, hitboxes, spawns y la ruta que sigue cada
 * enemigo. También se activa con `?debug` en la URL.
 */
export const DEBUG_GAME = false;
