'use client';

import { getSupabase } from '@/lib/supabase/client';
import type { GameResult } from './types';

/**
 * Guardado del resultado de una partida.
 *
 * Hoy funciona en local: el récord vive en `localStorage` y el juego es
 * jugable sin backend, igual que el resto de juegos del proyecto.
 *
 * El envío a Supabase queda montado pero APAGADO, y conviene explicar por qué
 * no basta con encenderlo: este ranking va a repartir premios, así que la
 * puntuación NO puede llegar como un número que manda el navegador. Cualquiera
 * abriría la consola y escribiría `score = 999999999`.
 *
 * El diseño previsto, en este orden:
 *
 *   1. Migración en `supabase/migraciones/` (siguiendo la numeración) con dos
 *      tablas: `match_sessions` (partida abierta: user_id, level, seed,
 *      started_at, status) y `match_scores` (resultado validado).
 *   2. Una función SECURITY DEFINER `start_match_session(level)` que crea la
 *      partida en el servidor y devuelve el `session_id` y la SEMILLA del
 *      tablero. El cliente ya sabe generar el tablero a partir de una semilla
 *      (`new Board(level, seed)`), así que el servidor puede reproducir la
 *      misma partida.
 *   3. Otra función `finish_match_session(session_id, score, moves_used,
 *      movimientos)` que RECHAZA lo que no cuadre: sesión inexistente o ya
 *      cerrada, duración menor que un mínimo razonable, más puntos de los que
 *      permite el nivel, movimientos usados por encima de los del nivel, o un
 *      segundo envío de la misma sesión.
 *   4. RLS: nadie escribe en `match_scores` directamente; solo esas funciones.
 *
 * Con la lista de movimientos guardada (paso 3) se puede además re-simular la
 * partida en el servidor con el mismo motor y confirmar la puntuación exacta,
 * que es la única validación que no se puede falsificar. Por eso el motor de
 * `core/` no depende de PixiJS: para poder correrlo también fuera del
 * navegador el día que haga falta.
 *
 * Mientras nada de eso exista, no se manda nada: mejor no escribir en una base
 * cuya forma todavía no está decidida.
 */

const GUARDAR_EN_SUPABASE = false;

/** Nombre previsto para la tabla de resultados. Ver el comentario de arriba. */
const TABLA = 'match_scores';

const BEST_KEY = 'sugu-match-best';
const PROGRESO_KEY = 'sugu-match-progreso';

export function leerRecord(): number {
  if (typeof window === 'undefined') return 0;
  const v = Number(window.localStorage.getItem(BEST_KEY) ?? 0);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function guardarRecord(score: number): boolean {
  if (typeof window === 'undefined') return false;
  if (score <= leerRecord()) return false;
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
    return true;
  } catch {
    return false;
  }
}

/** Estrellas conseguidas en cada nivel, para el mapa de niveles del futuro. */
export function leerProgreso(): Record<number, number> {
  if (typeof window === 'undefined') return {};
  try {
    const crudo = window.localStorage.getItem(PROGRESO_KEY);
    return crudo ? (JSON.parse(crudo) as Record<number, number>) : {};
  } catch {
    return {};
  }
}

function guardarProgreso(level: number, stars: number) {
  if (typeof window === 'undefined') return;
  try {
    const progreso = leerProgreso();
    if ((progreso[level] ?? 0) >= stars) return;
    progreso[level] = stars;
    window.localStorage.setItem(PROGRESO_KEY, JSON.stringify(progreso));
  } catch {
    // almacenamiento no disponible: el progreso se queda en memoria
  }
}

/**
 * Cierra la partida. Nunca lanza: un fallo aquí no puede impedir que salga el
 * cartel de nivel completado.
 */
export async function guardarResultado(resultado: GameResult): Promise<void> {
  try {
    guardarRecord(resultado.score);
    if (resultado.won) guardarProgreso(resultado.level, resultado.stars);
  } catch {
    /* almacenamiento no disponible */
  }

  if (!GUARDAR_EN_SUPABASE) return;

  try {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from(TABLA).insert({
      level: resultado.level,
      score: resultado.score,
      stars: resultado.stars,
      moves_used: resultado.movesUsed,
      duration_ms: resultado.duration,
      won: resultado.won,
    });
  } catch {
    // sin conexión o tabla ausente: la partida ya está guardada en local
  }
}
