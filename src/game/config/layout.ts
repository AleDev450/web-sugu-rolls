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
   */
  dangerGraceMs: 1500,
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
} as const;
