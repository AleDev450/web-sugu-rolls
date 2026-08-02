'use client';

/**
 * Puente entre el juego y la base de datos (ver `supabase/schema.sql`).
 *
 *   1. canjear el código   -> redeem_code()    abre la sesión de la partida
 *   2. registrar el puntaje -> finish_session() cierra esa misma sesión
 *   3. tabla de posiciones  -> get_ranking()    solo nickname y puntaje
 *
 * Todo pasa por funciones SECURITY DEFINER: el cliente nunca lee las tablas.
 * Si no hay Supabase configurado, o alguna función todavía no está desplegada,
 * se cae a localStorage para que el juego siga siendo jugable.
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

/** Datos que la base ya conoce del jugador (si canjeó estando logueado). */
export interface DatosJugador {
  nickname?: string;
  name?: string;
  phone?: string;
}

export interface CanjeResultado {
  ok: boolean;
  /** Mensaje listo para pintar en la ventana cuando `ok` es false. */
  mensaje?: string;
  jugador?: DatosJugador;
}

const MENSAJES_CANJE: Record<string, string> = {
  CODIGO_INVALIDO: 'Código incorrecto, inténtalo de nuevo',
  CODIGO_USADO: 'Este código ya fue usado',
  CODIGO_EXPIRADO: 'Este código ya venció',
};

const DEVICE_KEY = 'sugu_device';

/**
 * Marca estable de este navegador. Va en el canje para que solo quien abrió la
 * partida pueda retomarla: si otra persona teclea un código ya usado, la base
 * responde CODIGO_USADO aunque la partida siguiera abierta.
 *
 * No identifica a nadie: es un aleatorio guardado en localStorage.
 */
function idDeEsteNavegador(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // navegación privada con almacenamiento bloqueado: se canjea sin reanudar
    return null;
  }
}

/**
 * Sesión de la partida en curso. La abre el canje y la cierra el game over.
 * No es estado de UI (nadie se repinta por ella), así que vive aquí y no en
 * el store; se limpia al registrar el puntaje para no cerrarla dos veces.
 */
let sesionActual: string | null = null;

export function getSessionId(): string | null {
  return sesionActual;
}

function canjeLocal(code: string): CanjeResultado {
  sesionActual = null;
  return code === CODIGO_DEMO
    ? { ok: true }
    : { ok: false, mensaje: MENSAJES_CANJE.CODIGO_INVALIDO };
}

/**
 * Canjea el código contra `redeem_code` (un código = una partida). Si Supabase
 * no está configurado —o la función aún no existe en la base— cae al código de
 * demo para no dejar el juego sin entrada.
 */
export async function redeemAccessCode(raw: string): Promise<CanjeResultado> {
  const code = normalizeAccessCode(raw);
  if (code.length < CODE_LENGTH) {
    return { ok: false, mensaje: MENSAJES_CANJE.CODIGO_INVALIDO };
  }

  const sb = getSupabase();
  if (!sb) return canjeLocal(code);

  let { data, error } = await sb.rpc('redeem_code', {
    p_code: code,
    p_device: idDeEsteNavegador(),
  });

  /*
   * PGRST202 = no existe una función con esos argumentos: la base todavía
   * tiene el `redeem_code` anterior a `p_device`. Se reintenta con la firma
   * vieja para no dejar sin jugar a nadie mientras se actualiza el esquema
   * (ojo: hasta entonces un código a medio jugar sí lo puede retomar otro).
   */
  if (error?.code === 'PGRST202') {
    ({ data, error } = await sb.rpc('redeem_code', { p_code: code }));
  }
  if (error) return canjeLocal(code);

  const fila = (Array.isArray(data) ? data[0] : data) as
    | {
        ok: boolean;
        error: string | null;
        session_id: string | null;
        player_nickname: string | null;
        player_name: string | null;
        player_phone: string | null;
      }
    | undefined;
  if (!fila) return canjeLocal(code);

  if (!fila.ok) {
    sesionActual = null;
    return {
      ok: false,
      mensaje: MENSAJES_CANJE[fila.error ?? ''] ?? MENSAJES_CANJE.CODIGO_INVALIDO,
    };
  }

  sesionActual = fila.session_id;
  return {
    ok: true,
    jugador: {
      nickname: fila.player_nickname ?? undefined,
      name: fila.player_name ?? undefined,
      phone: fila.player_phone ?? undefined,
    },
  };
}

// ---------------------------------------------------------------------
// Registro del puntaje
// ---------------------------------------------------------------------

export interface ScoreSubmission {
  nickname: string;
  name: string;
  phone: string;
  score: number;
  /** ISO — momento del registro */
  at: string;
}

export interface RegistroResultado {
  ok: boolean;
  mensaje?: string;
}

const MENSAJES_CIERRE: { patron: string; texto: string }[] = [
  { patron: 'SESION_YA_CERRADA', texto: 'Esta partida ya fue registrada' },
  { patron: 'SESION_INVALIDA', texto: 'La partida expiró, vuelve a canjear tu código' },
  { patron: 'DATOS_INCOMPLETOS', texto: 'Completa nickname, nombre y teléfono' },
  { patron: 'PUNTAJE_INVALIDO', texto: 'El puntaje no es válido' },
  { patron: 'NO_AUTORIZADO', texto: 'Esta partida es de otro jugador' },
];

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

function guardarLocal(s: ScoreSubmission): void {
  if (typeof window === 'undefined') return;
  const pending = readPending();
  pending.push(s);
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

/**
 * Cierra la partida en la base con `finish_session`. La copia local se guarda
 * siempre: sirve de respaldo si la red falla y de ranking cuando no hay BD.
 */
export async function submitScore(s: ScoreSubmission): Promise<RegistroResultado> {
  guardarLocal(s);

  const sb = getSupabase();
  if (!sb || !sesionActual) return { ok: true };

  const { error } = await sb.rpc('finish_session', {
    p_session_id: sesionActual,
    p_score: s.score,
    p_nickname: s.nickname,
    p_full_name: s.name,
    p_phone: s.phone,
  });

  if (!error) {
    sesionActual = null;
    return { ok: true };
  }

  const conocido = MENSAJES_CIERRE.find((m) => error.message.includes(m.patron));
  return {
    ok: false,
    mensaje: conocido?.texto ?? 'No se pudo registrar tu partida, inténtalo de nuevo',
  };
}

// ---------------------------------------------------------------------
// Tabla de posiciones
// ---------------------------------------------------------------------

export interface RankEntry {
  nickname: string;
  score: number;
}

/** Partidas registradas en este dispositivo: respaldo cuando no hay BD. */
function rankingLocal(limit: number): RankEntry[] {
  return readPending()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({ nickname: s.nickname, score: s.score }));
}

/**
 * Ranking global (`get_ranking`): un jugador ocupa un solo puesto, con su
 * mejor partida. Devuelve únicamente nickname y puntaje.
 */
export async function getRanking(limit = 10): Promise<RankEntry[]> {
  const sb = getSupabase();
  if (!sb) return rankingLocal(limit);

  const { data, error } = await sb.rpc('get_ranking', { p_limit: limit });
  if (error || !Array.isArray(data)) return rankingLocal(limit);

  return (data as { jugador: string | null; puntaje: number }[]).map((r) => ({
    nickname: r.jugador ?? 'Anónimo',
    score: r.puntaje,
  }));
}
