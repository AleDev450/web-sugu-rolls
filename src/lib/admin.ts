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
  /** cantidades a la venta con su precio; vacío = precio único */
  presentaciones: { piezas: number; precio: number }[];
  /** grupos de personalización; vacío = producto simple */
  opciones: { titulo: string; min: number; max: number; opciones: string[] }[];
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

/**
 * Comprueba que una escritura haya tocado alguna fila.
 *
 * ESTO ES IMPORTANTE: cuando una política RLS bloquea un UPDATE, PostgREST no
 * devuelve error — responde "correcto, 0 filas". Sin esta comprobación el
 * panel decía "Guardado" y en la base no cambiaba nada, que es justo el
 * síntoma de "guardo en el dashboard y la web no se entera".
 *
 * Por eso todas las escrituras piden las filas de vuelta con `.select()`: si
 * no vuelve ninguna, es que la base rechazó el cambio.
 */
function exigirFilas(filas: unknown[] | null, error: { message: string } | null) {
  if (error) throw error;
  if (!filas || filas.length === 0) {
    throw new Error(
      'La base de datos rechazó el cambio: no se modificó ninguna fila. ' +
        'Suele ser que la cuenta no está marcada como administradora ' +
        '(profiles.is_admin = true).'
    );
  }
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
  return (data ?? []).map((p) => ({
    ...p,
    precio: Number(p.precio),
    presentaciones: (p.presentaciones ?? []).map(
      (v: { piezas: number | string; precio: number | string }) => ({
        piezas: Number(v.piezas),
        precio: Number(v.precio),
      })
    ),
  })) as ProductoAdmin[];
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
  const { data, error } = await q.select('id');
  exigirFilas(data, error);
}

export async function guardarPaquete(p: PaqueteAdmin) {
  const { id, ...campos } = p;
  const q = id
    ? sb().from('packages').update(campos).eq('id', id)
    : sb().from('packages').insert(campos);
  const { data, error } = await q.select('id');
  exigirFilas(data, error);
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

/** Enciende o apaga partes de la web (banderas `mod_*` y `solo_juego`). */
export async function guardarModulos(campos: Record<string, boolean>) {
  const { data, error } = await sb()
    .from('site_settings')
    .update(campos)
    .eq('id', 1)
    .select('id');
  exigirFilas(data, error);
}

export async function guardarAjustes(campos: Record<string, string>) {
  const { data, error } = await sb()
    .from('site_settings')
    .update(campos)
    .eq('id', 1)
    .select('id');
  exigirFilas(data, error);
}

// ---------- libro de reclamaciones ----------

export type EstadoReclamo = 'pendiente' | 'respondido' | 'cerrado';

export interface ReclamoAdmin {
  id: string;
  /** correlativo de la hoja; es la constancia que tiene el consumidor */
  numero: number;
  estado: EstadoReclamo;
  tipo: 'reclamo' | 'queja';
  tipo_bien: 'producto' | 'servicio';

  nombre: string;
  domicilio: string;
  tipo_documento: string;
  documento: string;
  correo: string;
  telefono: string;
  menor_edad: boolean;
  apoderado: string | null;

  local: string;
  canal: string;
  moneda: string;
  monto: number | null;
  bien_detalle: string;

  fecha_pedido: string | null;
  numero_pedido: string | null;
  detalle: string;
  pedido_cliente: string;

  respuesta: string | null;
  respondido_at: string | null;
  creado: string;
  /** fecha límite legal de respuesta: 30 días calendario desde el registro */
  vence: string;
}

export async function listarReclamos(estado?: EstadoReclamo): Promise<ReclamoAdmin[]> {
  const { data, error } = await sb().rpc('admin_reclamos', {
    p_estado: estado ?? null,
    p_limit: 300,
  });
  if (error) throw error;
  return (data ?? []) as ReclamoAdmin[];
}

/**
 * Guarda la respuesta del proveedor.
 *
 * El reclamo en sí NO se puede editar ni borrar: el libro tiene que
 * conservarse íntegro. Lo único que se añade es la respuesta y su estado.
 */
export async function responderReclamo(
  id: string,
  respuesta: string,
  estado: EstadoReclamo = 'respondido'
) {
  const { error } = await sb().rpc('admin_responder_reclamo', {
    p_id: id,
    p_respuesta: respuesta,
    p_estado: estado,
  });
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
  const { data, error } = await sb()
    .from('page_sections')
    .update(campos)
    .eq('id', id)
    .select('id');
  exigirFilas(data, error);
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

// ---------- slider de portada ----------

export interface SlideAdmin {
  id?: string;
  titulo: string;
  subtitulo: string;
  imagen: string;
  imagen_movil: string;
  /** object-position: qué zona se conserva al recortar */
  foco: string;
  foco_movil: string;
  /** oscurecido de la foto, 0-100 */
  velo: number;
  boton_texto: string;
  boton_enlace: string;
  orden: number;
  activo: boolean;
}

export async function listarSlides(): Promise<SlideAdmin[]> {
  const { data, error } = await sb().from('slides').select('*').order('orden');
  if (error) throw error;
  return (data ?? []) as SlideAdmin[];
}

export async function guardarSlide(d: SlideAdmin) {
  const { id, ...campos } = d;
  const q = id
    ? sb().from('slides').update(campos).eq('id', id)
    : sb().from('slides').insert(campos);
  const { data, error } = await q.select('id');
  exigirFilas(data, error);
}

export async function borrarSlide(id: string) {
  const { error } = await sb().from('slides').delete().eq('id', id);
  if (error) throw error;
}

// ---------- categorías ----------

export interface CategoriaAdmin {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activa: boolean;
}

export async function guardarCategoria(c: CategoriaAdmin, esNueva: boolean) {
  const q = esNueva
    ? sb().from('categories').insert(c)
    : sb().from('categories').update({
        nombre: c.nombre,
        descripcion: c.descripcion,
        orden: c.orden,
        activa: c.activa,
      }).eq('id', c.id);
  const { data, error } = await q.select('id');
  exigirFilas(data, error);
}

export async function borrarCategoria(id: string) {
  const { error } = await sb().from('categories').delete().eq('id', id);
  if (error) throw error;
}

/** Borra la cuenta de un cliente. Falla si tiene pedidos o si es admin. */
export async function borrarUsuario(id: string) {
  const { error } = await sb().rpc('admin_borrar_usuario', { p_user: id });
  if (error) throw error;
}

// ---------- usuarios registrados ----------

export interface UsuarioAdmin {
  id: string;
  nickname: string;
  full_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  correo: string | null;
  creado: string;
  saldo: number;
  ganados: number;
  nivel: 'bronce' | 'plata' | 'oro' | 'platino' | 'black';
  pedidos: number;
  gastado: number;
  /** total de coincidencias, para saber cuántas páginas hay */
  total: number;
}

/**
 * Clientes registrados, paginados EN LA BASE: se piden solo las filas de la
 * página pedida en vez de traerlas todas y cortarlas en el navegador.
 */
export async function listarUsuarios(
  pagina: number,
  porPagina: number,
  buscar = ''
): Promise<{ items: UsuarioAdmin[]; total: number }> {
  const { data, error } = await sb().rpc('admin_usuarios', {
    p_limit: porPagina,
    p_offset: pagina * porPagina,
    p_buscar: buscar || null,
  });
  if (error) throw error;

  const filas = (data ?? []) as UsuarioAdmin[];
  return {
    items: filas.map((u) => ({ ...u, gastado: Number(u.gastado), total: Number(u.total) })),
    // sin filas no hay ventana que devuelva el total: son cero coincidencias
    total: filas.length > 0 ? Number(filas[0].total) : 0,
  };
}

/**
 * Suma o resta puntos a mano. `delta` positivo acredita, negativo descuenta.
 *
 * No escribe un saldo: añade una línea al libro mayor con su motivo, igual
 * que una compra o un canje. Devuelve el saldo resultante.
 */
export async function ajustarPuntos(
  userId: string,
  delta: number,
  motivo: string
): Promise<number> {
  const { data, error } = await sb().rpc('admin_ajustar_puntos', {
    p_user: userId,
    p_delta: delta,
    p_motivo: motivo || null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

// ---------- pedidos de la tienda ----------

export type EstadoPedido = 'pendiente' | 'pagado' | 'entregado' | 'cancelado';

export interface PedidoAdmin {
  id: string;
  numero: number;
  estado: EstadoPedido;
  total: number;
  /** reparto, aparte del total. No genera puntos. */
  delivery: number;
  /** ruta del comprobante en el bucket privado, si lo adjuntó */
  comprobante: string | null;
  nombre: string;
  telefono: string;
  direccion: string;
  nota: string | null;
  correo: string | null;
  puntos: number;
  creado: string;
  pagado: string | null;
  items: {
    nombre: string;
    precio: number;
    cantidad: number;
    /** lo elegido en un producto configurable */
    opciones?: Record<string, string[]>;
  }[];
}

export async function listarPedidos(estado?: EstadoPedido): Promise<PedidoAdmin[]> {
  const { data, error } = await sb().rpc('admin_pedidos', {
    p_estado: estado ?? null,
    p_limit: 200,
  });
  if (error) throw error;
  return ((data ?? []) as PedidoAdmin[]).map((p) => ({
    ...p,
    total: Number(p.total),
    delivery: Number(p.delivery ?? 0),
  }));
}

/** Confirma el pago y acredita los puntos. Devuelve cuántos se dieron. */
export async function confirmarPago(id: string): Promise<number> {
  const { data, error } = await sb().rpc('admin_confirmar_pago', { p_order: id });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Fija el costo de reparto de un pedido. */
export async function fijarDelivery(id: string, monto: number): Promise<number> {
  const { data, error } = await sb().rpc('admin_set_delivery', {
    p_order: id,
    p_monto: monto,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/**
 * Enlace temporal para ver un comprobante.
 *
 * El bucket es privado —son capturas de pagos— así que no hay URL fija: se
 * firma una que caduca en cinco minutos cada vez que se quiere mirar.
 */
export async function verComprobante(ruta: string): Promise<string> {
  const { data, error } = await sb().storage.from('comprobantes').createSignedUrl(ruta, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function cambiarEstadoPedido(id: string, estado: EstadoPedido) {
  const { error } = await sb().rpc('admin_estado_pedido', { p_order: id, p_estado: estado });
  if (error) throw error;
}

// ---------- canjes por puntos ----------

export interface CanjeAdmin {
  id: string;
  nombre: string;
  tipo: 'descuento' | 'producto' | 'juego';
  costo_puntos: number;
  codigo: string | null;
  estado: 'disponible' | 'usado' | 'entregado';
  cliente: string;
  telefono: string | null;
  correo: string | null;
  creado: string;
}

export async function listarCanjes(): Promise<CanjeAdmin[]> {
  const { data, error } = await sb().rpc('admin_canjes', { p_limit: 200 });
  if (error) throw error;
  return (data ?? []) as CanjeAdmin[];
}

export async function cambiarEstadoCanje(id: string, estado: CanjeAdmin['estado']) {
  const { error } = await sb().rpc('admin_estado_canje', { p_canje: id, p_estado: estado });
  if (error) throw error;
}

export interface RecompensaAdmin {
  id?: string;
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

export async function listarRecompensasAdmin(): Promise<RecompensaAdmin[]> {
  const { data, error } = await sb().from('rewards').select('*').order('orden');
  if (error) throw error;
  return (data ?? []) as RecompensaAdmin[];
}

export async function guardarRecompensa(r: RecompensaAdmin) {
  const { id, ...campos } = r;
  const q = id
    ? sb().from('rewards').update(campos).eq('id', id)
    : sb().from('rewards').insert(campos);
  const { data, error } = await q.select('id');
  exigirFilas(data, error);
}

export async function borrarRecompensa(id: string) {
  const { error } = await sb().from('rewards').delete().eq('id', id);
  if (error) throw error;
}

export async function estadisticas() {
  const { data, error } = await sb().rpc('admin_stats');
  if (error) throw error;
  return data?.[0] ?? null;
}
