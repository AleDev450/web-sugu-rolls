import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para el navegador.
 *
 * Devuelve `null` si no hay variables configuradas, para que el juego funcione
 * offline (récord en localStorage) mientras el backend no esté montado.
 */

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

export interface ScoreRow {
  id?: string;
  player: string;
  score: number;
  max_tier: number;
  created_at?: string;
}

/** Sube una puntuación. No-op silencioso si Supabase no está configurado. */
export async function submitScore(row: ScoreRow): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from('scores').insert(row);
  return !error;
}

export async function fetchLeaderboard(limit = 20): Promise<ScoreRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('scores')
    .select('*')
    .order('score', { ascending: false })
    .limit(limit);
  return error ? [] : ((data ?? []) as ScoreRow[]);
}
