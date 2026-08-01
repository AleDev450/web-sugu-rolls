'use client';

/**
 * Registro de partidas y validación de códigos de acceso.
 *
 * TODO(BD): cuando exista la tabla en Supabase, `submitScore` debe insertar
 * ahí y `isValidAccessCode` debe consultar los códigos válidos. Por ahora:
 * - el código válido es fijo (VALID_CODE)
 * - las partidas se acumulan en localStorage para no perderlas
 */

/** Código de acceso provisional ("del 1 al 6"). */
const VALID_CODE = '123456';

export function isValidAccessCode(code: string): boolean {
  return code === VALID_CODE;
}

export interface ScoreSubmission {
  nickname: string;
  name: string;
  phone: string;
  score: number;
  /** ISO — momento del registro */
  at: string;
}

const PENDING_KEY = 'sugu_pending_scores';

function readPending(): ScoreSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as ScoreSubmission[]) : [];
  } catch {
    return [];
  }
}

/** Guarda el registro en la cola local; se migrará a la BD cuando exista. */
export async function submitScore(s: ScoreSubmission): Promise<void> {
  const pending = readPending();
  pending.push(s);
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

/**
 * Tabla de posiciones. TODO(BD): sustituir por la consulta al ranking global;
 * hoy son las partidas registradas en este dispositivo.
 */
export function getTopScores(limit = 10): ScoreSubmission[] {
  return readPending()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
