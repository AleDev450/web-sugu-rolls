'use client';

import { getSupabase } from '@/lib/supabase/client';

/**
 * Operaciones del panel de administración.
 *
 * Todas exigen sesión de administrador: las políticas RLS de Supabase
 * rechazan la escritura si `is_admin()` es falso, así que la seguridad no
 * depende de esconder botones en la interfaz.
 */

export interface ProductoAdmin {
  id?: string;
  slug: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  imagen: string;
  etiqueta: string | null;
  destacado: boolean;
  activo: boolean;
  orden: number;
}

export interface PaqueteAdmin {
  id?: string;
  slug: string;
  nombre: string;
  piezas: number;
  precio: number;
  ideal: string;
  incluye: string[];
  imagen: string;
  mas_pedido: boolean;
  activo: boolean;
  orden: number;
}

export interface TestimonioAdmin {
  id?: string;
  nombre: string;
  comentario: string;
  estrellas: number;
  activo: boolean;
  orden: number;
}

export class SinBackend extends Error {
  constructor() {
    super('Supabase no está configurado');
    this.name = 'SinBackend';
  }
}

function sb() {
  const cliente = getSupabase();
  if (!cliente) throw new SinBackend();
  return cliente;
}

// ---------- sesión ----------

export async function iniciarSesion(correo: string, clave: string) {
  const { data, error } = await sb().auth.signInWithPassword({
    email: correo,
    password: clave,
  });
  if (error) throw error;
  return data;
}

export async function cerrarSesion() {
  await sb().auth.signOut();
}

export async function usuarioActual() {
  const cliente = getSupabase();
  if (!cliente) return null;
  const { data } = await cliente.auth.getUser();
  return data.user;
}

/**
 * ¿La sesión actual tiene permisos de administrador?
 *
 * Devuelve también el error del RPC. Antes se resumía todo a `false`, y eso
 * confundía dos casos muy distintos: que la cuenta no sea admin, o que la
 * llamada falle porque `public.is_admin()` no existe todavía o le falta el
 * `grant execute`. El panel mostraba el mismo mensaje para ambos.
 */
export async function esAdmin(): Promise<{ admin: boolean; error: string | null }> {
  const cliente = getSupabase();
  if (!cliente) return { admin: false, error: 'Supabase no está configurado' };

  const { data, error } = await cliente.rpc('is_admin');
  if (error) {
    return { admin: false, error: `${error.message}${error.code ? ` (${error.code})` : ''}` };
  }
  return { admin: data === true, error: null };
}

// ---------- lectura para el panel (incluye lo desactivado) ----------

export async function listarProductos(): Promise<ProductoAdmin[]> {
  const { data, error } = await sb().from('products').select('*').order('orden');
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, precio: Number(p.precio) })) as ProductoAdmin[];
}

export async function listarPaquetes(): Promise<PaqueteAdmin[]> {
  const { data, error } = await sb().from('packages').select('*').order('orden');
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, precio: Number(p.precio) })) as PaqueteAdmin[];
}

export async function listarTestimonios(): Promise<TestimonioAdmin[]> {
  const { data, error } = await sb().from('testimonials').select('*').order('orden');
  if (error) throw error;
  return (data ?? []) as TestimonioAdmin[];
}

export async function listarCategorias() {
  const { data, error } = await sb().from('categories').select('*').order('orden');
  if (error) throw error;
  return data ?? [];
}

// ---------- escritura ----------

/** Inserta o actualiza según venga `id`. */
export async function guardarProducto(p: ProductoAdmin) {
  const { id, ...campos } = p;
  const q = id
    ? sb().from('products').update(campos).eq('id', id)
    : sb().from('products').insert(campos);
  const { error } = await q;
  if (error) throw error;
}

export async function guardarPaquete(p: PaqueteAdmin) {
  const { id, ...campos } = p;
  const q = id
    ? sb().from('packages').update(campos).eq('id', id)
    : sb().from('packages').insert(campos);
  const { error } = await q;
  if (error) throw error;
}

export async function guardarTestimonio(t: TestimonioAdmin) {
  const { id, ...campos } = t;
  const q = id
    ? sb().from('testimonials').update(campos).eq('id', id)
    : sb().from('testimonials').insert(campos);
  const { error } = await q;
  if (error) throw error;
}

export async function borrar(tabla: 'products' | 'packages' | 'testimonials', id: string) {
  const { error } = await sb().from(tabla).delete().eq('id', id);
  if (error) throw error;
}

// ---------- ajustes del sitio ----------

export async function traerAjustesAdmin() {
  const { data, error } = await sb().from('site_settings').select('*').eq('id', 1).single();
  if (error) throw error;
  return data;
}

export async function guardarAjustes(campos: Record<string, string>) {
  const { error } = await sb().from('site_settings').update(campos).eq('id', 1);
  if (error) throw error;
}

// ---------- secciones de las páginas ----------

export interface SeccionAdmin {
  id: string;
  pagina: string;
  titulo_panel: string;
  etiqueta: string;
  titulo: string;
  manuscrito: string;
  bajada: string;
  imagen: string;
  extra: Record<string, unknown>;
  orden: number;
}

export async function listarSecciones(): Promise<SeccionAdmin[]> {
  const { data, error } = await sb().from('page_sections').select('*').order('orden');
  if (error) throw error;
  return (data ?? []) as SeccionAdmin[];
}

export async function guardarSeccion(s: SeccionAdmin) {
  const { id, ...campos } = s;
  const { error } = await sb().from('page_sections').update(campos).eq('id', id);
  if (error) throw error;
}

// ---------- códigos del juego ----------

export interface CodigoAdmin {
  id: string;
  code: string;
  label: string | null;
  created_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
}

export async function listarCodigos(limite = 200): Promise<CodigoAdmin[]> {
  const { data, error } = await sb()
    .from('access_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as CodigoAdmin[];
}

/**
 * Genera un lote. Los códigos NO caducan nunca: `p_expires_at` va siempre en
 * null. Un cliente que se guarda el código un mes tiene que poder jugarlo.
 */
export async function generarCodigos(cantidad: number, etiqueta: string) {
  const { data, error } = await sb().rpc('generate_access_codes', {
    p_count: cantidad,
    p_label: etiqueta || null,
    p_expires_at: null,
  });
  if (error) throw error;
  return data as { nuevo_codigo: string }[];
}

/**
 * Borra códigos. Con `soloSinUsar` en false arrastra también las partidas de
 * los códigos canjeados (la FK es ON DELETE CASCADE). Devuelve cuántos borró.
 */
export async function borrarCodigos(soloSinUsar: boolean): Promise<number> {
  const { data, error } = await sb().rpc('admin_borrar_codigos', {
    p_solo_sin_usar: soloSinUsar,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Deja el ranking a cero. No libera los códigos ya canjeados. */
export async function resetearRanking(): Promise<number> {
  const { data, error } = await sb().rpc('admin_reset_ranking');
  if (error) throw error;
  return Number(data ?? 0);
}

// ---------- partidas jugadas (ranking del panel) ----------

/**
 * Una partida con todo lo que el admin necesita para entregar el premio.
 * El teléfono y el nombre real solo salen por aquí: el ranking público
 * (`get_ranking`) devuelve nickname y puntaje y nada más.
 */
export interface PartidaAdmin {
  id: string;
  nickname: string | null;
  full_name: string | null;
  phone: string | null;
  score: number | null;
  started_at: string;
  finished_at: string | null;
  /** código canjeado para jugar esta partida */
  codigo: string | null;
  codigo_creado: string | null;
  codigo_etiqueta: string | null;
}

/** Forma cruda de la fila: PostgREST anida el código como objeto o arreglo. */
type FilaPartida = Omit<PartidaAdmin, 'codigo' | 'codigo_creado' | 'codigo_etiqueta'> & {
  access_codes:
    | { code: string; created_at: string; label: string | null }
    | { code: string; created_at: string; label: string | null }[]
    | null;
};

/**
 * Partidas ordenadas por puntaje. `soloTerminadas` deja fuera las sesiones que
 * se abrieron pero nunca registraron puntaje (cerró la pestaña a medias).
 *
 * El join con `access_codes` funciona por la FK `code_id`; las políticas RLS
 * exigen `is_admin()` en ambas tablas, así que un no-admin recibe vacío.
 */
export async function listarPartidas(
  soloTerminadas = true,
  limite = 300
): Promise<PartidaAdmin[]> {
  let q = sb()
    .from('game_sessions')
    .select(
      'id, nickname, full_name, phone, score, started_at, finished_at, access_codes(code, created_at, label)'
    )
    .order('score', { ascending: false, nullsFirst: false })
    .order('finished_at', { ascending: true })
    .limit(limite);

  if (soloTerminadas) q = q.not('score', 'is', null);

  const { data, error } = await q;
  if (error) throw error;

  return ((data ?? []) as unknown as FilaPartida[]).map(({ access_codes, ...p }) => {
    const cod = Array.isArray(access_codes) ? access_codes[0] : access_codes;
    return {
      ...p,
      codigo: cod?.code ?? null,
      codigo_creado: cod?.created_at ?? null,
      codigo_etiqueta: cod?.label ?? null,
    };
  });
}

export async function estadisticas() {
  const { data, error } = await sb().rpc('admin_stats');
  if (error) throw error;
  return data?.[0] ?? null;
}
