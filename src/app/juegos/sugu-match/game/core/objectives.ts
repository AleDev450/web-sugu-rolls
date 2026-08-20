import type { LevelConfig, ObjectiveState, TurnStep } from '../types';

/**
 * Objetivos del nivel.
 *
 * Funciones puras sobre una lista de objetivos: reciben lo que ha pasado en un
 * paso y devuelven la lista nueva. Nada de mutar el store desde el motor —el
 * motor entrega hechos, el store decide cuándo repintar.
 */

export function crearObjetivos(level: LevelConfig): ObjectiveState[] {
  return level.objectives.map((o) => ({ ...o, remaining: o.amount }));
}

/** Descuenta de los objetivos lo conseguido en un paso. */
export function aplicarPaso(
  objetivos: readonly ObjectiveState[],
  paso: TurnStep,
  scoreTotal: number
): ObjectiveState[] {
  return objetivos.map((o) => {
    if (o.remaining === 0) return o;

    if (o.type === 'collect' && o.tile) {
      const n = paso.collected[o.tile] ?? 0;
      return n ? { ...o, remaining: Math.max(0, o.remaining - n) } : o;
    }

    if (o.type === 'break' && o.layer) {
      const n = paso.broken[o.layer] ?? 0;
      return n ? { ...o, remaining: Math.max(0, o.remaining - n) } : o;
    }

    if (o.type === 'score') {
      return { ...o, remaining: Math.max(0, o.amount - scoreTotal) };
    }

    return o;
  });
}

export function completados(objetivos: readonly ObjectiveState[]): boolean {
  return objetivos.every((o) => o.remaining === 0);
}
