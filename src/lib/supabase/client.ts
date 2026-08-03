import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para el navegador.
 *
 * Devuelve `null` si no hay variables configuradas, para que el juego funcione
 * offline (récord en localStorage) mientras el backend no esté montado.
 */

let client: SupabaseClient | null = null;

/**
 * Clave pública del proyecto.
 *
 * Supabase renombró estas claves: los proyectos nuevos entregan una
 * `sb_publishable_...` bajo el nombre PUBLISHABLE_KEY, y los antiguos una
 * `eyJ...` bajo ANON_KEY. Se aceptan las dos porque valen igual y el nombre
 * depende de cuándo se creó el proyecto.
 *
 * IMPORTANTE: `process.env` se sustituye en tiempo de compilación, así que hay
 * que nombrar cada variable entera. Un acceso dinámico no funcionaría.
 */
function clavePublica(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    undefined
  );
}

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = clavePublica();

  if (!url || !key) {
    if (typeof window !== 'undefined') {
      console.error(
        '[supabase] Sin configurar: falta NEXT_PUBLIC_SUPABASE_URL o la clave pública ' +
          '(NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY). ' +
          'Sin ellas no hay sesión, ni pedidos, ni puntos.'
      );
    }
    return null;
  }

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
