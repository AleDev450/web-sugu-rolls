'use client';

/**
 * Registro de partidas y validación de códigos de acceso.
 *
 * TODO(BD): `submitScore` sigue guardando en localStorage hasta que se enganche
 * con `finish_session`. El canje del código sí va contra Supabase.
 */

import { getSupabase } from '@/lib/supabase/client';

/** Largo de los códigos que genera el panel (`random_code`). */
export const CODE_LENGTH = 6;

/**
 * Los códigos del panel son alfanuméricos en MAYÚSCULAS: se limpia cualquier
 * separador que traiga el ticket ("AB2-3CD") y se normaliza igual que hace
 * `redeem_code` en la base, para que el jugador pueda teclearlo como quiera.
 */
export function normalizeAccessCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH);
}

/**
 * Código de respaldo para desarrollo: solo sirve cuando no hay Supabase
 * configurado o la función `redeem_code` todavía no está desplegada.
 */
const CODIGO_DEMO = '123456';

export interface CanjeResultado {
  ok: boolean;
  /** Mensaje listo para pintar en la ventana cuando `ok` es false. */
  mensaje?: string;
  /** Sesión abierta por el canje; la usará el registro de puntaje (TODO BD). */
  sessionId?: string;
}

const MENSAJES: Record<string, string> = {
  CODIGO_INVALIDO: 'Código incorrecto, inténtalo de nuevo',
  CODIGO_USADO: 'Este código ya fue usado',
  CODIGO_EXPIRADO: 'Este código ya venció',
};

function canjeLocal(code: string): CanjeResultado {
  return code === CODIGO_DEMO
    ? { ok: true }
    : { ok: false, mensaje: MENSAJES.CODIGO_INVALIDO };
}

/**
 * Canjea el código contra `redeem_code` (un código = una partida). Si Supabase
 * no está configurado —o la función aún no existe en la base— cae al código de
 * demo para no dejar el juego sin entrada.
 */
export async function redeemAccessCode(raw: string): Promise<CanjeResultado> {
  const code = normalizeAccessCode(raw);
  if (code.length < CODE_LENGTH) {
    return { ok: false, mensaje: MENSAJES.CODIGO_INVALIDO };
  }

  const sb = getSupabase();
  if (!sb) return canjeLocal(code);

  const { data, error } = await sb.rpc('redeem_code', { p_code: code });
  if (error) return canjeLocal(code);

  const fila = (Array.isArray(data) ? data[0] : data) as
    | { ok: boolean; error: string | null; session_id: string | null }
    | undefined;
  if (!fila) return canjeLocal(code);

  return fila.ok
    ? { ok: true, sessionId: fila.session_id ?? undefined }
    : { ok: false, mensaje: MENSAJES[fila.error ?? ''] ?? MENSAJES.CODIGO_INVALIDO };
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
