import type { ClearCause, LayerKind, SpecialKind } from '../types';

/**
 * Puntuación y equilibrio.
 *
 * Todo lo que se toca para que el juego se sienta más o menos generoso está
 * aquí. Ni el motor ni la interfaz llevan números sueltos: si un valor hace
 * falta en dos sitios, se importa de este archivo.
 */

export const SCORING = {
  /** Puntos por grupo según cuántas piezas lo forman. */
  porGrupo: { 3: 100, 4: 250, 5: 500 } as Record<number, number>,
  /** A partir de 5 piezas, cada una extra suma esto. */
  porPiezaExtra: 150,

  /** Puntos por cada pieza barrida por un especial, según quién la barrió. */
  porBarrido: {
    match: 0,
    stripedH: 60,
    stripedV: 60,
    bomb: 80,
    rainbow: 120,
    booster: 40,
  } satisfies Record<ClearCause, number>,

  /** Premio por fabricar un especial. */
  porCrear: {
    none: 0,
    stripedH: 200,
    stripedV: 200,
    bomb: 400,
    rainbow: 800,
  } satisfies Record<SpecialKind, number>,

  /** Romper una cubierta puntúa aunque la pieza siga en el tablero. */
  porRomper: {
    none: 0,
    ice: 60,
    rope: 60,
  } satisfies Record<LayerKind, number>,

  /**
   * Multiplicador de cascada: 1x la jugada, 1.5x la primera cascada, 2x la
   * segunda... con tope. La subida es suave a propósito: una cascada larga ya
   * destruye mucho, si además multiplicara por 5 el marcador se dispararía.
   */
  comboPaso: 0.5,
  comboMax: 5,

  /** Al completar el nivel, cada movimiento sobrante se convierte en puntos. */
  bonusPorMovimiento: 300,
} as const;

/** Multiplicador de la cascada número `combo` (1 = jugada del jugador). */
export function multiplicadorCombo(combo: number): number {
  return Math.min(1 + (combo - 1) * SCORING.comboPaso, SCORING.comboMax);
}

/** Puntos base de un grupo de `n` piezas emparejadas. */
export function puntosGrupo(n: number): number {
  if (n <= 4) return SCORING.porGrupo[Math.max(3, n)];
  return SCORING.porGrupo[5] + (n - 5) * SCORING.porPiezaExtra;
}

/** Estrellas conseguidas con `score` según los cortes del nivel. */
export function estrellas(score: number, cortes: { one: number; two: number; three: number }): number {
  if (score >= cortes.three) return 3;
  if (score >= cortes.two) return 2;
  if (score >= cortes.one) return 1;
  return 0;
}
