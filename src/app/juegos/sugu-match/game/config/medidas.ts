/**
 * Medidas y tiempos de la parte visual.
 *
 * Nada de esto depende de la resolución: el tablero se calcula a partir del
 * hueco que le da el navegador (ver `render/BoardView.ts`), así que aquí solo
 * hay proporciones y duraciones.
 */

/** Margen entre el borde del tablero y la primera casilla, en fracción de casilla. */
export const MARGEN_TABLERO = 0.22;

/** La pieza no ocupa la casilla entera: deja aire para que se lea la rejilla. */
export const ESCALA_PIEZA = 0.9;

/** Lado máximo de casilla en px de pantalla. Evita piezas gigantes en desktop. */
export const CASILLA_MAX = 82;
export const CASILLA_MIN = 30;

/**
 * Duraciones en segundos (GSAP trabaja en segundos, no en ms).
 *
 * Están en el rango que pide un Match-3: el swap tiene que sentirse
 * instantáneo y la caída lo bastante lenta para leerse, pero sin que el
 * jugador espere. Subir `caida` por encima de 0.35 hace el juego pastoso.
 */
export const DUR = {
  swap: 0.17,
  swapVuelta: 0.15,
  pop: 0.18,
  caida: 0.3,
  spawn: 0.28,
  especial: 0.26,
  /** Espera extra tras un especial para que se vea el barrido. */
  respiroEspecial: 0.1,
  shuffle: 0.45,
} as const;

/** Retardo entre piezas que caen en la misma columna. Da sensación de peso. */
export const CAIDA_ESCALON = 0.03;
/** Retardo entre piezas que revientan en el mismo grupo. */
export const POP_ESCALON = 0.025;

/** Partículas por pieza destruida. Bajo a propósito: móviles. */
export const PARTICULAS_POR_PIEZA = 5;
export const PARTICULAS_MAX = 220;
