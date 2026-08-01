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

/** ¿La sesión actual tiene permisos de administrador? */
export async function esAdmin(): Promise<boolean> {
  const cliente = getSupabase();
  if (!cliente) return false;
  const { data, error } = await cliente.rpc('is_admin');
  return !error && data === true;
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

export async function generarCodigos(cantidad: number, etiqueta: string, venceEl?: string) {
  const { data, error } = await sb().rpc('generate_access_codes', {
    p_count: cantidad,
    p_label: etiqueta || null,
    p_expires_at: venceEl || null,
  });
  if (error) throw error;
  return data as { nuevo_codigo: string }[];
}

export async function estadisticas() {
  const { data, error } = await sb().rpc('admin_stats');
  if (error) throw error;
  return data?.[0] ?? null;
}
