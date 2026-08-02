'use client';

import { getSupabase } from '@/lib/supabase/client';
import {
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
  } catch {
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
    if (error || !data?.length) return SECCIONES;

    const mezcla = { ...SECCIONES };
    for (const fila of data as Seccion[]) {
      const local = SECCIONES[fila.id];
      if (!local) continue;
      mezcla[fila.id] = {
        ...local,
        ...fila,
        // si `extra` viene vacío desde la BD, se conservan los datos locales
        extra: fila.extra && Object.keys(fila.extra).length > 0 ? fila.extra : local.extra,
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
    return data as AjustesSitio;
  }, AJUSTES_LOCALES);
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
    if (error || !data?.length) return CATEGORIAS;
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
    if (error || !data?.length) return PRODUCTOS;
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
    if (error || !data?.length) return PAQUETES;
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
    if (error || !data?.length) return TESTIMONIOS;
    return (data as FilaTestimonio[]).map((f) => ({
      nombre: f.nombre,
      comentario: f.comentario,
      estrellas: f.estrellas,
    }));
  }, TESTIMONIOS);
}
