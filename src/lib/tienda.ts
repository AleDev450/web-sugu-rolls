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
    body: JSON.stringify({ ...d, correo: d.correo.trim().toLowerCase() }),
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
    '[registro] Falta la clave secreta del servidor (SUPABASE_SECRET_KEY o ' +
      'SUPABASE_SERVICE_ROLE_KEY): se usa el alta normal, que envía correo de ' +
      'confirmación y está sujeta al límite de envíos de Supabase.'
  );

  // --- respaldo: registro normal, sujeto al ajuste del proyecto ---
  const { data, error } = await sb().auth.signUp({
    email: d.correo.trim().toLowerCase(),
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
    // mismo normalizado que el alta: "Ana@X.com" y "ana@x.com" son la misma
    // cuenta, y Supabase guarda el correo en minúsculas
    email: correo.trim().toLowerCase(),
    password: clave,
  });
  if (error) throw error;
}

/**
 * Acceso con Google.
 *
 * Vale para entrar Y para darse de alta: si el correo de Google no tiene
 * cuenta, Supabase la crea en el momento; si ya existe y está confirmada,
 * ENLAZA la identidad a la cuenta de siempre en vez de duplicarla. Por eso
 * quien se registró con correo y contraseña puede entrar luego con Google (y
 * al revés) y encuentra sus mismos puntos y pedidos.
 *
 * Ese enlace automático exige que la cuenta anterior tenga el correo
 * confirmado. Las que crea `/api/registro` nacen con `email_confirm: true`,
 * así que cumplen.
 */
export async function entrarConGoogle(destino = '/cuenta') {
  const { error } = await sb().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?destino=${encodeURIComponent(destino)}`,
      // sin esto Google entra directo con la última cuenta usada, y en un
      // equipo compartido eso significa entrar como otra persona
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
}

/**
 * Acceso con Google sin salir de la web.
 *
 * Google Identity Services devuelve un token de identidad firmado en la
 * propia página; aquí se canjea por sesión. El `nonce` es el original: Google
 * guardó su hash dentro del token y Supabase comprueba que cuadren, que es lo
 * que impide reutilizar un token conseguido en otro sitio.
 *
 * Da igual que sea alta o inicio de sesión, y el enlazado por correo funciona
 * exactamente igual que por el camino con redirección.
 */
export async function entrarConTokenGoogle(token: string, nonce: string) {
  const { error } = await sb().auth.signInWithIdToken({
    provider: 'google',
    token,
    nonce,
  });
  if (error) throw error;
}

/**
 * Formas de entrar que tiene ya esta cuenta: `email`, `google`…
 *
 * Sirve para no ofrecerle "crear contraseña" a quien ya tiene una, ni decirle
 * "conecta Google" a quien ya lo tiene conectado.
 */
export async function misAccesos(): Promise<string[]> {
  const cliente = getSupabase();
  if (!cliente) return [];
  const { data, error } = await cliente.auth.getUserIdentities();
  if (error) return [];
  return (data?.identities ?? []).map((i) => i.provider);
}

/**
 * Define o cambia la contraseña de la cuenta.
 *
 * Quien entró primero con Google no tiene ninguna. Con esto se pone una y a
 * partir de ahí puede entrar por los dos lados, que es justo lo que se pide.
 */
export async function establecerClave(clave: string) {
  if (clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  const { error } = await sb().auth.updateUser({ password: clave });
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

export type MetodoPago = 'yape' | 'plin' | 'tarjeta';

export interface Pedido {
  id: string;
  numero: number;
  estado: 'pendiente' | 'pagado' | 'entregado' | 'cancelado';
  total: number;
  /** reparto, aparte del total; lo fija el local según el distrito */
  delivery: number;
  /** ruta del comprobante adjunto, o null si todavía no lo subió */
  comprobante: string | null;
  metodo_pago: MetodoPago | null;
  /** enlace de pago con tarjeta, pegado a mano por el admin */
  link_pago: string | null;
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
 * Crea el pedido. Solo se mandan slugs, presentación y cantidades: los precios los pone la
 * base leyendo `products`, así que da igual lo que se manipule en el cliente.
 */
export async function crearPedido(
  items: {
    slug: string;
    piezas?: number;
    cantidad: number;
    opciones?: Record<string, string[]>;
  }[],
  direccion: string,
  nota: string,
  metodoPago: MetodoPago
): Promise<{ id: string; numero: number; total: number }> {
  const { data, error } = await sb().rpc('crear_pedido', {
    p_items: items,
    p_direccion: direccion || null,
    p_nota: nota || null,
    p_metodo_pago: metodoPago,
  });
  if (error) throw error;

  const fila = (Array.isArray(data) ? data[0] : data) as {
    id: string;
    numero: number;
    total: number;
  };
  // el id hace falta para adjuntarle luego el comprobante del Yape
  return { id: fila.id, numero: Number(fila.numero), total: Number(fila.total) };
}

/**
 * Sube la captura del Yape y la ata al pedido.
 *
 * El bucket es privado: la imagen no queda accesible por URL pública, solo el
 * panel puede abrirla con un enlace firmado. Se guarda la RUTA, no una URL.
 */
export async function adjuntarComprobante(pedidoId: string, archivo: File): Promise<void> {
  const cliente = sb();

  if (!archivo.type.startsWith('image/') && archivo.type !== 'application/pdf') {
    throw new Error('Adjunta una imagen o un PDF.');
  }
  if (archivo.size > 5 * 1024 * 1024) {
    throw new Error('El archivo no puede pasar de 5 MB.');
  }

  const ext = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  // una carpeta por pedido: así el panel sabe a cuál pertenece cada archivo
  const ruta = `${pedidoId}/${Date.now()}.${ext}`;

  const { error: fallo } = await cliente.storage
    .from('comprobantes')
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (fallo) throw fallo;

  const { error } = await cliente.rpc('adjuntar_comprobante', {
    p_order: pedidoId,
    p_ruta: ruta,
  });
  if (error) throw error;
}

export async function misPedidos(): Promise<Pedido[]> {
  const { data, error } = await sb().rpc('mis_pedidos', { p_limit: 30 });
  if (error) throw error;
  return ((data ?? []) as Pedido[]).map((p) => ({
    ...p,
    total: Number(p.total),
    delivery: Number(p.delivery ?? 0),
  }));
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

export type Nivel = 'bronce' | 'plata' | 'oro' | 'platino' | 'black';

export interface Tarjeta {
  /** puntos disponibles para canjear */
  saldo: number;
  /** puntos ganados de por vida: es lo que determina el nivel */
  ganados: number;
  nivel: Nivel;
  siguiente: Nivel | null;
  faltan: number;
}

/** Cortes en puntos GANADOS de por vida. Deben coincidir con `corte_nivel()`. */
export const NIVELES: Record<Nivel, { nombre: string; desde: number }> = {
  bronce: { nombre: 'Bronce', desde: 0 },
  plata: { nombre: 'Plata', desde: 300 },
  oro: { nombre: 'Oro', desde: 800 },
  platino: { nombre: 'Platino', desde: 2000 },
  black: { nombre: 'Black', desde: 4000 },
};

export const ORDEN_NIVELES: Nivel[] = ['bronce', 'plata', 'oro', 'platino', 'black'];

/**
 * Número de socio, estable y legible, derivado del id de la cuenta.
 *
 * Se calcula en el cliente a partir del uuid en vez de guardar un correlativo:
 * no hace falta otra columna y dos personas distintas nunca comparten uuid.
 */
export function numeroSocio(id: string): string {
  const hex = id.replace(/[^0-9a-f]/gi, '').slice(-6);
  return `SR ${(parseInt(hex, 16) % 1_000_000).toString().padStart(6, '0')}`;
}

export async function miTarjeta(): Promise<Tarjeta> {
  const vacia: Tarjeta = {
    saldo: 0,
    ganados: 0,
    nivel: 'bronce',
    siguiente: 'plata',
    faltan: NIVELES.plata.desde,
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
