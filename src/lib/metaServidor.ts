import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

/**
 * Lectura de SEO para el servidor: `generateMetadata`, `DatosEstructurados`
 * y las rutas de favicon.
 *
 * Vive fuera de `lib/contenido.ts` (que empieza con `'use client'`) porque
 * Next.js no deja invocar una función de un módulo de cliente desde un
 * Server Component: "Attempted to call traerAjustes() from the server but
 * traerAjustes is on the client." Estas son las mismas consultas, mínimas y
 * de solo lectura, para poder correrlas en el servidor.
 *
 * Nunca lanzan: sin variables de entorno o ante cualquier fallo devuelven
 * los valores vacíos/seguros, y quien llama cae a lo que trae el código.
 */

export interface MetaSitio {
  nombre: string;
  seo_nombre_sitio: string;
  seo_nombre_alterno: string;
  /** ruta pública del favicon en el almacén; la sirven /icon.png y /favicon.ico */
  seo_favicon: string;
  /** ruta pública del logo en el almacén; va en JSON-LD (Restaurant.logo, Organization.logo) */
  seo_logo: string;
  seo_plantilla_titulo: string;
  seo_robots_index: boolean;
  seo_robots_follow: boolean;
  meta_titulo: string;
  meta_descripcion: string;
  meta_imagen: string;
  telefono: string;
  correo: string;
  direccion: string;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
}

const VACIO: MetaSitio = {
  nombre: '',
  seo_nombre_sitio: '',
  seo_nombre_alterno: '',
  seo_favicon: '',
  seo_logo: '',
  seo_plantilla_titulo: '',
  // seguros por defecto: un fallo de conexión no debe pedirle a Google que deje de indexar
  seo_robots_index: true,
  seo_robots_follow: true,
  meta_titulo: '',
  meta_descripcion: '',
  meta_imagen: '',
  telefono: '',
  correo: '',
  direccion: '',
  instagram: null,
  facebook: null,
  tiktok: null,
};

let cliente: SupabaseClient | null = null;

function clienteServidor(): SupabaseClient | null {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cliente = createClient(url, key);
  return cliente;
}

/*
 * Caché en memoria de proceso, de vida corta.
 *
 * Cada página del sitio llama a esto por su cuenta desde `generateMetadata`
 * o desde `DatosEstructurados`; sin caché, una sola tanda de generación
 * estática (o de revalidación) dispara una consulta idéntica a Supabase por
 * cada una de las ~10 páginas. 60s alcanza para cubrir esa tanda entera sin
 * demorar de forma perceptible un cambio real hecho en el panel.
 */
const TTL_MS = 60_000;
let cacheSitio: { valor: MetaSitio; hasta: number } | null = null;

export async function traerMetaSitio(): Promise<MetaSitio> {
  if (cacheSitio && cacheSitio.hasta > Date.now()) return cacheSitio.valor;

  const sb = clienteServidor();
  if (!sb) return VACIO;

  try {
    const { data, error } = await sb.from('site_settings').select('*').eq('id', 1).single();
    if (error || !data) return VACIO;

    const valor: MetaSitio = {
      nombre: data.nombre ?? '',
      seo_nombre_sitio: data.seo_nombre_sitio || data.nombre || '',
      seo_nombre_alterno: data.seo_nombre_alterno ?? '',
      seo_favicon: data.seo_favicon ?? '',
      seo_logo: data.seo_logo ?? '',
      seo_plantilla_titulo: data.seo_plantilla_titulo ?? '',
      seo_robots_index: data.seo_robots_index !== false,
      seo_robots_follow: data.seo_robots_follow !== false,
      meta_titulo: data.meta_titulo ?? '',
      meta_descripcion: data.meta_descripcion ?? '',
      meta_imagen: data.meta_imagen ?? '',
      telefono: data.telefono ?? '',
      correo: data.correo ?? '',
      direccion: data.direccion ?? '',
      instagram: data.instagram ?? null,
      facebook: data.facebook ?? null,
      tiktok: data.tiktok ?? null,
    };
    cacheSitio = { valor, hasta: Date.now() + TTL_MS };
    return valor;
  } catch {
    return VACIO;
  }
}

const cachePaginas = new Map<string, { valor: { titulo: string; descripcion: string }; hasta: number }>();

/** Título/descripción propios de una ruta (`page_seo`). Vacíos = usa lo del código de esa página. */
export async function traerSeoPagina(ruta: string): Promise<{ titulo: string; descripcion: string }> {
  const enCache = cachePaginas.get(ruta);
  if (enCache && enCache.hasta > Date.now()) return enCache.valor;

  const vacio = { titulo: '', descripcion: '' };
  const sb = clienteServidor();
  if (!sb) return vacio;

  try {
    const { data } = await sb
      .from('page_seo')
      .select('titulo, descripcion')
      .eq('ruta', ruta)
      .maybeSingle();
    const valor = { titulo: data?.titulo ?? '', descripcion: data?.descripcion ?? '' };
    cachePaginas.set(ruta, { valor, hasta: Date.now() + TTL_MS });
    return valor;
  } catch {
    return vacio;
  }
}

/**
 * Metadata de una página, lista para `export const generateMetadata`.
 *
 * `porDefecto` es lo que esa página ya trae escrito en su propio código; el
 * override de `/admin/seo` → SEO por página, si existe, lo reemplaza campo
 * por campo (título solo, o descripción solo, es válido).
 */
export async function metadataPagina(
  ruta: string,
  porDefecto: { title: string; description: string } | null = null
): Promise<Metadata> {
  const o = await traerSeoPagina(ruta);
  const titulo = o.titulo.trim();
  const descripcion = o.descripcion.trim();

  return {
    alternates: { canonical: ruta },
    title: titulo || porDefecto?.title,
    description: descripcion || porDefecto?.description,
  };
}
