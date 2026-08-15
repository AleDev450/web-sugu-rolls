import { createClient } from '@supabase/supabase-js';

export interface MetaSitio {
  nombre: string;
  meta_titulo: string;
  meta_descripcion: string;
  meta_imagen: string;
}

const VACIO: MetaSitio = { nombre: '', meta_titulo: '', meta_descripcion: '', meta_imagen: '' };

/**
 * Ajustes de SEO para `generateMetadata` en el layout raíz.
 *
 * Vive fuera de `lib/contenido.ts` (que empieza con `'use client'`) porque
 * Next.js no deja invocar una función de un módulo de cliente desde un
 * Server Component: "Attempted to call traerAjustes() from the server but
 * traerAjustes is on the client." Esta es la misma consulta, mínima y de
 * solo lectura, para poder correrla en el servidor.
 *
 * Nunca lanza: sin variables de entorno o ante cualquier fallo devuelve
 * campos vacíos, y `layout.tsx` cae a los valores del código.
 */
export async function traerMetaSitio(): Promise<MetaSitio> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return VACIO;

  try {
    const sb = createClient(url, key);
    const { data, error } = await sb
      .from('site_settings')
      .select('nombre, meta_titulo, meta_descripcion, meta_imagen')
      .eq('id', 1)
      .single();
    if (error || !data) return VACIO;
    return {
      nombre: data.nombre ?? '',
      meta_titulo: data.meta_titulo ?? '',
      meta_descripcion: data.meta_descripcion ?? '',
      meta_imagen: data.meta_imagen ?? '',
    };
  } catch {
    return VACIO;
  }
}
