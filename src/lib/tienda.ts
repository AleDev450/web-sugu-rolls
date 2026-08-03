'use client';

/**
 * Cuenta del cliente, pedidos, puntos y canjes (ver `supabase/tienda.sql`).
 *
 * Todo lo que escribe pasa por funciones SECURITY DEFINER: el navegador nunca
 * manda precios ni totales, los calcula la base a partir de `products`.
 */

import { getSupabase } from '@/lib/supabase/client';

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

// ---------------------------------------------------------------------
// Cuenta
// ---------------------------------------------------------------------

export interface DatosRegistro {
  correo: string;
  clave: string;
  nombre: string;
  apellido: string;
  telefono: string;
  direccion: string;
}

export interface Perfil {
  id: string;
  nickname: string;
  full_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
}

/**
 * Alta de cliente. Los datos van en `user_metadata` y el trigger
 * `handle_new_user` los copia a `profiles` al crearse la cuenta.
 *
 * Pasa por `/api/registro`, que crea la cuenta YA CONFIRMADA desde el
 * servidor: así no se envía ningún correo y el cliente entra en el acto.
 * Si esa ruta no está configurada (falta la clave de servicio), cae al
 * registro normal de Supabase para no dejar la web sin alta.
 */
export async function registrarse(d: DatosRegistro) {
  const res = await fetch('/api/registro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(d),
  });

  if (res.ok) {
    // nace confirmada: se entra directo, sin buzón de por medio
    await ingresar(d.correo, d.clave);
    return { confirmar: false };
  }

  const fallo = (await res.json().catch(() => ({}))) as { error?: string; mensaje?: string };

  if (fallo.error !== 'SIN_CONFIGURAR') {
    throw new Error(fallo.mensaje ?? 'No se pudo crear la cuenta.');
  }

  console.warn(
    '[registro] Falta SUPABASE_SERVICE_ROLE_KEY: se usa el alta normal, que envía correo ' +
      'de confirmación y está sujeta al límite de envíos de Supabase.'
  );

  // --- respaldo: registro normal, sujeto al ajuste del proyecto ---
  const { data, error } = await sb().auth.signUp({
    email: d.correo.trim(),
    password: d.clave,
    options: {
      data: {
        full_name: d.nombre.trim(),
        last_name: d.apellido.trim(),
        phone: d.telefono.trim(),
        address: d.direccion.trim(),
      },
    },
  });
  if (error) throw error;

  // sin sesión = el proyecto exige confirmar el correo
  return { confirmar: !data.session };
}

export async function ingresar(correo: string, clave: string) {
  const { error } = await sb().auth.signInWithPassword({
    email: correo.trim(),
    password: clave,
  });
  if (error) throw error;
}

export async function salir() {
  const cliente = getSupabase();
  await cliente?.auth.signOut();
}

/** Perfil del cliente logueado, o null si no hay sesión. */
export async function miPerfil(): Promise<Perfil | null> {
  const cliente = getSupabase();
  if (!cliente) return null;

  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return null;

  const { data, error } = await cliente
    .from('profiles')
    .select('id, nickname, full_name, last_name, phone, address')
    .eq('id', sesion.user.id)
    .single();

  return error ? null : (data as Perfil);
}

export async function correoActual(): Promise<string | null> {
  const cliente = getSupabase();
  if (!cliente) return null;
  const { data } = await cliente.auth.getUser();
  return data.user?.email ?? null;
}

/** Actualiza los datos que el cliente puede cambiar por su cuenta. */
export async function guardarPerfil(p: Partial<Perfil>) {
  const cliente = sb();
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error('Sin sesión');

  const { error } = await cliente
    .from('profiles')
    .update({
      full_name: p.full_name ?? null,
      last_name: p.last_name ?? null,
      phone: p.phone ?? null,
      address: p.address ?? null,
    })
    .eq('id', sesion.user.id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------

export interface ItemPedido {
  nombre: string;
  precio: number;
  cantidad: number;
}

export interface Pedido {
  id: string;
  numero: number;
  estado: 'pendiente' | 'pagado' | 'entregado' | 'cancelado';
  total: number;
  puntos: number;
  creado: string;
  items: ItemPedido[];
}

export const ESTADO_PEDIDO: Record<Pedido['estado'], string> = {
  pendiente: 'Esperando pago',
  pagado: 'Pago confirmado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

/**
 * Crea el pedido. Solo se mandan slugs y cantidades: los precios los pone la
 * base leyendo `products`, así que da igual lo que se manipule en el cliente.
 */
export async function crearPedido(
  items: { slug: string; cantidad: number }[],
  direccion: string,
  nota: string
): Promise<{ numero: number; total: number }> {
  const { data, error } = await sb().rpc('crear_pedido', {
    p_items: items,
    p_direccion: direccion || null,
    p_nota: nota || null,
  });
  if (error) throw error;

  const fila = (Array.isArray(data) ? data[0] : data) as { numero: number; total: number };
  return { numero: Number(fila.numero), total: Number(fila.total) };
}

export async function misPedidos(): Promise<Pedido[]> {
  const { data, error } = await sb().rpc('mis_pedidos', { p_limit: 30 });
  if (error) throw error;
  return ((data ?? []) as Pedido[]).map((p) => ({ ...p, total: Number(p.total) }));
}

// ---------------------------------------------------------------------
// Puntos y canjes
// ---------------------------------------------------------------------

export async function saldoPuntos(): Promise<number> {
  const cliente = getSupabase();
  if (!cliente) return 0;
  const { data, error } = await cliente.rpc('saldo_puntos');
  return error ? 0 : Number(data ?? 0);
}

export type Nivel = 'normal' | 'oro' | 'platino' | 'black';

export interface Tarjeta {
  /** puntos disponibles para canjear */
  saldo: number;
  /** puntos ganados de por vida: es lo que determina el nivel */
  ganados: number;
  nivel: Nivel;
  siguiente: Nivel | null;
  faltan: number;
}

export const NIVELES: Record<Nivel, { nombre: string; desde: number }> = {
  normal: { nombre: 'Normal', desde: 0 },
  oro: { nombre: 'Oro', desde: 500 },
  platino: { nombre: 'Platino', desde: 1500 },
  black: { nombre: 'Black', desde: 3000 },
};

export async function miTarjeta(): Promise<Tarjeta> {
  const vacia: Tarjeta = {
    saldo: 0,
    ganados: 0,
    nivel: 'normal',
    siguiente: 'oro',
    faltan: NIVELES.oro.desde,
  };

  const cliente = getSupabase();
  if (!cliente) return vacia;

  const { data, error } = await cliente.rpc('mi_tarjeta');
  if (error) return vacia;

  const fila = (Array.isArray(data) ? data[0] : data) as Tarjeta | undefined;
  if (!fila) return vacia;

  return {
    saldo: Number(fila.saldo),
    ganados: Number(fila.ganados),
    nivel: fila.nivel,
    siguiente: fila.siguiente,
    faltan: Number(fila.faltan),
  };
}

export interface Recompensa {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: 'descuento' | 'producto' | 'juego';
  costo_puntos: number;
  porcentaje: number | null;
  product_id: string | null;
  imagen: string;
  activo: boolean;
  orden: number;
}

export async function listarRecompensas(): Promise<Recompensa[]> {
  const { data, error } = await sb()
    .from('rewards')
    .select('*')
    .eq('activo', true)
    .order('orden');
  if (error) throw error;
  return (data ?? []) as Recompensa[];
}

export interface Canje {
  id: string;
  nombre: string;
  tipo: Recompensa['tipo'];
  costo_puntos: number;
  codigo: string | null;
  porcentaje: number | null;
  estado: 'disponible' | 'usado' | 'entregado';
  creado: string;
}

const MENSAJES_CANJE: Record<string, string> = {
  NO_AUTENTICADO: 'Inicia sesión para canjear',
  CANJE_NO_DISPONIBLE: 'Este canje ya no está disponible',
  PUNTOS_INSUFICIENTES: 'No te alcanzan los puntos',
};

export async function canjear(
  rewardId: string
): Promise<{ ok: boolean; mensaje?: string; codigo?: string }> {
  const { data, error } = await sb().rpc('canjear_recompensa', { p_reward: rewardId });
  if (error) return { ok: false, mensaje: 'No se pudo canjear, inténtalo de nuevo' };

  const fila = (Array.isArray(data) ? data[0] : data) as
    | { ok: boolean; error: string | null; codigo: string | null }
    | undefined;
  if (!fila) return { ok: false, mensaje: 'No se pudo canjear' };

  return fila.ok
    ? { ok: true, codigo: fila.codigo ?? undefined }
    : { ok: false, mensaje: MENSAJES_CANJE[fila.error ?? ''] ?? 'No se pudo canjear' };
}

export async function misCanjes(): Promise<Canje[]> {
  const { data, error } = await sb().rpc('mis_canjes', { p_limit: 50 });
  if (error) throw error;
  return (data ?? []) as Canje[];
}
