'use client';

import { getSupabase } from '@/lib/supabase/client';
import {
  type GrupoOpciones,
  type GrupoSaboresPromo,
  PRODUCTOS,
  PAQUETES,
  TESTIMONIOS,
  CATEGORIAS,
  type Producto,
  type Paquete,
  type Testimonio,
  type Categoria,
} from '@/data/productos';
import { SECCIONES, type Seccion, type SeccionId } from '@/data/secciones';
import { SITE } from '@/data/site';

/**
 * Contenido de la web.
 *
 * Si Supabase está configurado, lee de la base de datos (editable desde el
 * panel). Si no, cae a los datos de /src/data para que la web funcione sin
 * backend. Los componentes no saben de dónde vienen los datos.
 */

export interface AjustesSitio {
  nombre: string;
  eslogan: string;
  descripcion: string;
  telefono: string;
  whatsapp: string;
  correo: string;
  direccion: string;
  horario: string;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;

  /** Módulos encendidos. Ver "MÓDULOS DE LA WEB" en supabase/contenido.sql. */
  mod_carta: boolean;
  mod_paquetes: boolean;
  mod_catering: boolean;
  mod_promociones: boolean;
  mod_nosotros: boolean;
  mod_contacto: boolean;
  mod_cuenta: boolean;
  mod_juego: boolean;
  /** Interruptor maestro: apaga la web y deja solo /juego. */
  solo_juego: boolean;

  /** Textos legales en Markdown ligero. Vacío = página aún sin redactar. */
  terminos: string;
  privacidad: string;
  cookies: string;
  legales_actualizado: string | null;

  /**
   * Datos del titular del negocio. Encabezan el Libro de Reclamaciones, que
   * por ley debe mostrar la razón social y el RUC de quien vende — no el
   * nombre comercial.
   */
  razon_social: string;
  ruc: string;

  /** auto = por horario · abierta/cerrada = forzado desde el panel */
  tienda_modo: 'auto' | 'abierta' | 'cerrada';
  hora_apertura: string;
  hora_cierre: string;
  /** 0 = domingo … 6 = sábado */
  dias_atencion: number[];
  aviso_cerrado: string;

  /** píxeles extra entre el header y el slider; ajuste fino desde el panel */
  slider_margen: number;

  /**
   * Metas de SEO (/admin/seo). Vacías = se usan las del código
   * (`src/app/layout.tsx`), que es lo que sale hasta que se editen aquí.
   */
  meta_titulo: string;
  meta_descripcion: string;
  meta_imagen: string;

  /**
   * Coordenadas del local y tarifa de delivery, para estimar el costo según
   * la distancia con Google Maps. Sin coordenadas no se calcula nada: el
   * checkout solo pide la dirección, igual que antes.
   */
  tienda_lat: number | null;
  tienda_lng: number | null;
  delivery_tarifa_base: number;
  delivery_tarifa_km: number;
}

/** Diapositiva del carrusel de portada. */
export interface Slide {
  id: string;
  titulo: string;
  subtitulo: string;
  /** 1920×1080, para escritorio */
  imagen: string;
  /** vertical, para teléfonos. Vacía = se reutiliza la de escritorio */
  imagen_movil: string;
  /** `object-position`: qué zona de la foto se conserva al recortar */
  foco: string;
  foco_movil: string;
  /** oscurecido de la foto, 0-100; lo ajusta cada diapositiva */
  velo: number;
  boton_texto: string;
  boton_enlace: string;
  orden: number;
  activo: boolean;
}

/** Rutas que controla cada bandera, para filtrar menús y proteger páginas. */
export const RUTA_MODULO: Record<string, keyof AjustesSitio> = {
  '/carta': 'mod_carta',
  '/promociones': 'mod_paquetes',
  '/catering': 'mod_catering',
  '/sugu-games': 'mod_promociones',
  '/nosotros': 'mod_nosotros',
  '/contacto': 'mod_contacto',
  '/cuenta': 'mod_cuenta',
  '/juego': 'mod_juego',
};

/** ¿Está encendida la parte del sitio que sirve esta ruta? */
export function moduloActivo(ajustes: AjustesSitio, ruta: string): boolean {
  const clave = RUTA_MODULO[ruta];
  return clave ? ajustes[clave] === true : true;
}

const AJUSTES_LOCALES: AjustesSitio = {
  nombre: SITE.nombre,
  eslogan: SITE.eslogan,
  descripcion: SITE.descripcion,
  telefono: SITE.telefono,
  whatsapp: SITE.whatsapp,
  correo: SITE.correo,
  direccion: SITE.direccion,
  horario: SITE.horario,
  instagram: SITE.redes.instagram,
  facebook: SITE.redes.facebook,
  tiktok: SITE.redes.tiktok,
  // sin base de datos, la web se muestra entera
  mod_carta: true,
  mod_paquetes: true,
  mod_catering: true,
  mod_promociones: true,
  mod_nosotros: true,
  mod_contacto: true,
  mod_cuenta: true,
  mod_juego: true,
  solo_juego: false,
  terminos: '',
  privacidad: '',
  cookies: '',
  legales_actualizado: null,
  razon_social: 'INVERSIONES SUGU S.A.C.',
  ruc: '20608920961',
  // sin base de datos se asume abierto: es peor bloquear pedidos por error
  tienda_modo: 'auto',
  hora_apertura: '12:00',
  hora_cierre: '22:00',
  dias_atencion: [0, 1, 2, 3, 4, 5, 6],
  aviso_cerrado:
    'Estamos cerrados en este momento. Puedes ver la carta y volver en nuestro horario de atención.',
  slider_margen: 0,
  meta_titulo: '',
  meta_descripcion: '',
  meta_imagen: '',
  tienda_lat: null,
  tienda_lng: null,
  delivery_tarifa_base: 0,
  delivery_tarifa_km: 0,
};

/** ¿Hay backend configurado? */
export function hayBackend(): boolean {
  try {
    return getSupabase() !== null;
  } catch {
    return false;
  }
}

/**
 * Ejecuta una consulta y, ante cualquier problema (sin backend, tablas que aún
 * no existen, red caída, credenciales mal puestas), devuelve el contenido
 * local. La web nunca debe romperse por culpa de la base de datos.
 */
async function conRespaldo<T>(consulta: () => Promise<T>, respaldo: T): Promise<T> {
  try {
    return await consulta();
  } catch (e) {
    /*
     * El respaldo evita que la web se rompa, pero callar el motivo hacía
     * imposible entender por qué el panel guardaba y la web no cambiaba:
     * se veía contenido de ejemplo sin ninguna pista. Ahora queda en la
     * consola del navegador.
     */
    console.error('[contenido] consulta fallida, se usa el contenido local:', e);
    return respaldo;
  }
}

// --- filas tal como vienen de la base de datos ---

interface FilaProducto {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  precio: number | string;
  categoria: string;
  imagen: string;
  etiqueta: string | null;
  destacado: boolean;
  activo: boolean;
  orden: number;
  presentaciones: { piezas: number | string; precio: number | string }[] | null;
  opciones: GrupoOpciones[] | null;
}

interface FilaPaquete {
  id: string;
  slug: string;
  nombre: string;
  piezas: number;
  precio: number | string;
  ideal: string;
  incluye: string[];
  imagen: string;
  mas_pedido: boolean;
  activo: boolean;
  orden: number;
  grupos: GrupoSaboresPromo[] | null;
}

interface FilaTestimonio {
  id: string;
  nombre: string;
  comentario: string;
  estrellas: number;
  activo: boolean;
  orden: number;
}

function aProducto(f: FilaProducto): Producto {
  return {
    id: f.slug,
    nombre: f.nombre,
    descripcion: f.descripcion,
    precio: Number(f.precio),
    categoria: f.categoria as Producto['categoria'],
    imagen: f.imagen,
    destacado: f.destacado,
    etiqueta: (f.etiqueta ?? undefined) as Producto['etiqueta'],
    // los numéricos de Postgres llegan como texto por JSON
    presentaciones: (f.presentaciones ?? [])
      .map((p) => ({ piezas: Number(p.piezas), precio: Number(p.precio) }))
      .filter((p) => p.piezas > 0 && p.precio >= 0)
      .sort((a, b) => a.piezas - b.piezas),
    // se descartan los grupos mal formados: un grupo sin opciones dejaría
    // el configurador bloqueado sin nada que elegir
    opciones: (f.opciones ?? [])
      .filter((g) => g?.titulo && Array.isArray(g.opciones) && g.opciones.length > 0)
      .map((g) => ({
        ...g,
        // catálogo cargado antes de que las opciones llevaran precio: texto plano
        opciones: (g.opciones as unknown[]).map((o) =>
          typeof o === 'string' ? { nombre: o, precio: 0 } : (o as { nombre: string; precio: number })
        ),
      })),
  };
}

function aPaquete(f: FilaPaquete): Paquete {
  return {
    id: f.slug,
    nombre: f.nombre,
    piezas: f.piezas,
    precio: Number(f.precio),
    ideal: f.ideal,
    incluye: f.incluye ?? [],
    imagen: f.imagen,
    masPedido: f.mas_pedido,
    grupos: f.grupos ?? [],
  };
}

// --- lectura pública ---

/**
 * Textos e imágenes de las secciones. Devuelve siempre las nueve: las que la
 * base de datos no tenga se completan con el contenido local, así una fila
 * borrada por accidente no deja un hueco en la web.
 */
export function traerSecciones(): Promise<Record<SeccionId, Seccion>> {
  return conRespaldo(async () => {
    const sb = getSupabase();
    if (!sb) return SECCIONES;

    const { data, error } = await sb.from('page_sections').select('*');
    if (error || !data) return SECCIONES;

    const mezcla = { ...SECCIONES };
    for (const fila of data as Seccion[]) {
      /*
       * `local` puede no existir: una sección creada en la base que todavía no
       * está en el archivo. Antes se descartaba en silencio y editarla desde
       * el panel no tenía ningún efecto en la web.
       */
      const local = SECCIONES[fila.id];
      mezcla[fila.id] = {
        ...(local ?? {}),
        ...fila,
        // si `extra` viene vacío desde la BD, se conservan los datos locales
        extra:
          fila.extra && Object.keys(fila.extra).length > 0 ? fila.extra : (local?.extra ?? {}),
      };
    }
    return mezcla;
  }, SECCIONES);
}

export function traerAjustes(): Promise<AjustesSitio> {
  return conRespaldo(async () => {
    const sb = getSupabase();
    if (!sb) return AJUSTES_LOCALES;

    const { data, error } = await sb.from('site_settings').select('*').eq('id', 1).single();
    if (error || !data) return AJUSTES_LOCALES;

    // los numéricos de Postgres llegan como texto por JSON
    const fila = data as Record<string, unknown>;
    return {
      ...(data as AjustesSitio),
      tienda_lat: fila.tienda_lat != null ? Number(fila.tienda_lat) : null,
      tienda_lng: fila.tienda_lng != null ? Number(fila.tienda_lng) : null,
      delivery_tarifa_base: Number(fila.delivery_tarifa_base ?? 0),
      delivery_tarifa_km: Number(fila.delivery_tarifa_km ?? 0),
    } as AjustesSitio;
  }, AJUSTES_LOCALES);
}

/** Diapositivas activas del carrusel, en orden. */
export function traerSlides(): Promise<Slide[]> {
  return conRespaldo(async () => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb
      .from('slides')
      .select('*')
      .eq('activo', true)
      .order('orden');
    if (error || !data) return [];
    return data as Slide[];
  }, []);
}

/**
 * ¿Se aceptan pedidos ahora? Lo decide la BASE, no el reloj del navegador:
 * alguien con la hora del sistema cambiada podría pedir de madrugada.
 */
export function tiendaAbierta(): Promise<boolean> {
  return conRespaldo(async () => {
    const sb = getSupabase();
    if (!sb) return true;
    const { data, error } = await sb.rpc('tienda_abierta');
    return error ? true : data === true;
  }, true);
}

export function traerCategorias(): Promise<Categoria[]> {
  return conRespaldo(async () => {
    const sb = getSupabase();
    if (!sb) return CATEGORIAS;

    const { data, error } = await sb
      .from('categories')
      .select('id, nombre, descripcion')
      .eq('activa', true)
      .order('orden');
    if (error || !data) return CATEGORIAS;
    return data as Categoria[];
  }, CATEGORIAS);
}

export function traerProductos(): Promise<Producto[]> {
  return conRespaldo(async () => {
    const sb = getSupabase();
    if (!sb) return PRODUCTOS;

    const { data, error } = await sb
      .from('products')
      .select('*')
      .eq('activo', true)
      .order('orden');
    /*
     * Solo se cae al contenido local si la CONSULTA FALLA (sin backend, sin
     * permisos, tablas sin crear). Una tabla vacía es una respuesta legítima:
     * antes se trataba como error y la web seguía mostrando los productos de
     * ejemplo, así que borrar el último producto desde el panel no se veía.
     */
    if (error) return PRODUCTOS;
    if (!data) return PRODUCTOS;
    return (data as FilaProducto[]).map(aProducto);
  }, PRODUCTOS);
}

export async function traerFavoritos(): Promise<Producto[]> {
  const todos = await traerProductos();
  const destacados = todos.filter((p) => p.destacado);
  return destacados.length > 0 ? destacados : todos.slice(0, 5);
}

export function traerPaquetes(): Promise<Paquete[]> {
  return conRespaldo(async () => {
    const sb = getSupabase();
    if (!sb) return PAQUETES;

    const { data, error } = await sb
      .from('packages')
      .select('*')
      .eq('activo', true)
      .order('orden');
    if (error || !data) return PAQUETES;
    return (data as FilaPaquete[]).map(aPaquete);
  }, PAQUETES);
}

export function traerTestimonios(): Promise<Testimonio[]> {
  return conRespaldo(async () => {
    const sb = getSupabase();
    if (!sb) return TESTIMONIOS;

    const { data, error } = await sb
      .from('testimonials')
      .select('*')
      .eq('activo', true)
      .order('orden');
    if (error || !data) return TESTIMONIOS;
    return (data as FilaTestimonio[]).map((f) => ({
      nombre: f.nombre,
      comentario: f.comentario,
      estrellas: f.estrellas,
    }));
  }, TESTIMONIOS);
}
