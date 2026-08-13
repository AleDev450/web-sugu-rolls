/**
 * Todo el juego se piensa en un lienzo virtual de 480x854 (9:16).
 * El renderer calcula un único `scale` para encajarlo en la pantalla real,
 * así que la física y las posiciones nunca dependen del tamaño del device.
 */

export const DESIGN = {
  width: 480,
  height: 854,

  /**
   * Caja de cristal donde caen las piezas.
   * La barra HUD con arte (marco-hud.png) ocupa ~151px arriba
   * (480 de ancho / aspecto 3.18), así que la caja empieza debajo.
   */
  board: {
    x: 50,
    y: 210,
    w: 380,
    h: 560,
  },

  /** y de la línea roja, relativa al borde superior de la caja */
  dangerLineOffset: 8,

  /** altura desde la que se suelta la pieza (entre la barra HUD y la caja) */
  dropY: 180,
} as const;

export const BOARD_LEFT = DESIGN.board.x;
export const BOARD_RIGHT = DESIGN.board.x + DESIGN.board.w;
export const BOARD_TOP = DESIGN.board.y;
export const BOARD_BOTTOM = DESIGN.board.y + DESIGN.board.h;
export const DANGER_Y = BOARD_TOP + DESIGN.dangerLineOffset;

export const RULES = {
  /** El juego es de UNA sola vida: no hay revivir ni continuar. */
  lives: 1,
  /**
   * Derrota "no puede ingresar": ms que una pieza asentada puede quedar por
   * encima de la línea (sobresaliendo de la caja) antes de perder.
   *
   * 2026-08-02: 1500 -> 3000. Con segundo y medio no daba tiempo a reaccionar;
   * ahora el renderer pinta la cuenta atrás para que se pueda intentar
   * arreglar la pila antes de que llegue a cero.
   */
  dangerGraceMs: 3000,
  /**
   * Derrota "se sale": margen fuera de la caja a partir del cual una pieza
   * cuenta como escapada — derrota inmediata, sin gracia.
   */
  escapeMargin: 30,
  /** ms mínimos entre dos sueltas */
  dropCooldownMs: 380,
  /**
   * Si el jugador no suelta la ficha en este tiempo, se lanza sola desde la
   * posición de puntería actual. La guía dibuja la barrita de cuenta atrás.
   */
  autoDropMs: 5000,
  /** ms desde que nace una pieza hasta que puede activar la derrota */
  dangerImmunityMs: 900,
  /** ms que dura la ventana de combo */
  comboWindowMs: 1500,
  /**
   * Premio por juntar dos Sugu Supreme. Es la jugada más difícil del juego:
   * hay que completar dos cadenas enteras teniéndolas a la vez en el tablero,
   * ocupando sitio. Crear UN supreme da 550.
   */
  supremePairPoints: 3000,
} as const;

/**
 * Rampa de dificultad por tiempo de partida: la gravedad sube poco a poco, así
 * que las piezas caen más rápido y queda menos margen para apuntar y corregir.
 *
 * Se mide con tiempo JUGADO, no con reloj de pared: la pausa y los ratos con
 * la pestaña en segundo plano no cuentan (mismo criterio que la cuenta atrás
 * de derrota). Nadie gana dificultad por dejar el móvil encima de la mesa.
 *
 * Se multiplica con los factores de los poderes: KOYA (x0.45) sigue siendo un
 * alivio real aunque la rampa esté al tope, y el festival (x1.12) encima.
 */
export const RAMPA = {
  /** ms de juego hasta llegar al tope */
  fullAtMs: 10 * 60_000,
  /** multiplicador de gravedad en el tope */
  maxGravityMul: 1.6,
} as const;

/** Física (Matter.js) — un solo sitio para tunear el "feel". */
export const PHYSICS = {
  gravityY: 1.15,
  // 2026-08-01: 0.18 -> 0.15, menos rebote = pilas más estables y legibles
  restitution: 0.15,
  friction: 0.32,
  frictionStatic: 0.5,
  frictionAir: 0.002,
  density: 0.001,
  wallThickness: 60,
  /** iteraciones del solver: más = pilas más estables */
  positionIterations: 8,
  velocityIterations: 6,
  /** velocidad por debajo de la cual una pieza cuenta como "asentada" */
  restSpeed: 0.45,

  /*
   * ROMPER EL APILADO PERFECTO
   *
   * Un círculo que cae recto sobre otro círculo queda en equilibrio perfecto.
   * En el mundo real ese equilibrio es inestable y la pieza rueda; en la
   * simulación, sin ninguna asimetría que lo rompa, se queda clavado. Como la
   * puntería no se mueve sola entre lanzamientos y una fusión nace justo en el
   * punto medio de las dos piezas, soltar siempre en el mismo sitio creaba una
   * columna que se fusionaba sola indefinidamente: el tablero nunca se llenaba.
   *
   * Estos dos números meten la asimetría mínima para que eso no pase, sin
   * tocar dónde cae la ficha: el jugador sigue soltando donde apunta.
   */
  /** desplazamiento aleatorio del punto de suelta, en px de diseño */
  spawnJitter: 1.2,
  /** empujón horizontal aleatorio que recibe la pieza recién fusionada */
  mergeKick: 0.7,
} as const;
