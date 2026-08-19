'use client';

import { getSupabase } from '@/lib/supabase/client';
import { HIGHSCORE_KEY } from './config';
import type { GameResult } from './types';

/**
 * Guardado del resultado de una partida.
 *
 * Hoy funciona en local: el récord vive en `localStorage` y el juego es
 * jugable sin backend, igual que el resto de juegos del proyecto.
 *
 * El envío a Supabase queda montado pero APAGADO: la tabla de ranking de este
 * juego todavía no existe y no se ha tocado el esquema. Para encenderlo hacen
 * falta dos cosas, en este orden:
 *
 *   1. una migración nueva en `supabase/migraciones/` (siguiendo la
 *      numeración) que cree `maki_maze_scores` con RLS y una función
 *      SECURITY DEFINER para insertar, como hace `finish_session` en
 *      `supabase/schema.sql`;
 *   2. poner `GUARDAR_EN_SUPABASE` a true.
 *
 * Mientras tanto no se manda nada: mejor no escribir en una base cuya forma
 * todavía no está decidida.
 */

const GUARDAR_EN_SUPABASE = false;

/** Nombre previsto para la tabla de ranking. Ver el comentario de arriba. */
const TABLA = 'maki_maze_scores';

export function leerRecord(): number {
  if (typeof window === 'undefined') return 0;
  const v = Number(window.localStorage.getItem(HIGHSCORE_KEY) ?? 0);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function guardarRecord(score: number): boolean {
  if (typeof window === 'undefined') return false;
  if (score <= leerRecord()) return false;
  try {
    window.localStorage.setItem(HIGHSCORE_KEY, String(score));
    return true;
  } catch {
    return false;
  }
}

/**
 * Cierra la partida: récord local y, cuando se active, ranking en Supabase.
 * Nunca lanza: un fallo aquí no puede impedir que salga el Game Over.
 */
export async function guardarResultado(resultado: GameResult): Promise<void> {
  try {
    guardarRecord(resultado.score);
  } catch {
    /* almacenamiento no disponible */
  }

  if (!GUARDAR_EN_SUPABASE) return;

  try {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from(TABLA).insert({
      score: resultado.score,
      level: resultado.level,
      duration_ms: resultado.duration,
      enemies_eaten: resultado.enemiesEaten,
      collected: resultado.collectedItems,
    });
  } catch {
    // sin conexión o tabla ausente: la partida ya está guardada en local
  }
}
