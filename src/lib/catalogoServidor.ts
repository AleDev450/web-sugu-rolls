import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Lectura del catálogo para el servidor: los JSON-LD de producto y
 * promoción (`CartaJsonLd`, `PromocionesJsonLd`) se arman en el HTML antes
 * de llegar al navegador, y `lib/contenido.ts` (que hace lo mismo para la
 * UI) es `'use client'` — no se puede llamar desde un Server Component. Ver
 * el mismo razonamiento en `metaServidor.ts`.
 *
 * Nunca lanzan: sin variables de entorno o ante cualquier fallo devuelven
 * una lista vacía, y el componente que llama simplemente no imprime nada.
 */

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

export interface ProductoJsonLd {
  slug: string;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string;
  categoria: string;
}

export async function traerProductosServidor(): Promise<ProductoJsonLd[]> {
  const sb = clienteServidor();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('products')
      .select('slug, nombre, descripcion, precio, imagen, categoria')
      .eq('activo', true)
      .order('orden');
    if (error || !data) return [];
    return data.map((p) => ({ ...p, precio: Number(p.precio) }));
  } catch {
    return [];
  }
}

export interface PaqueteJsonLd {
  slug: string;
  nombre: string;
  ideal: string;
  precio: number;
  imagen: string;
}

export async function traerPaquetesServidor(): Promise<PaqueteJsonLd[]> {
  const sb = clienteServidor();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('packages')
      .select('slug, nombre, ideal, precio, imagen')
      .eq('activo', true)
      .order('orden');
    if (error || !data) return [];
    return data.map((p) => ({ ...p, precio: Number(p.precio) }));
  } catch {
    return [];
  }
}
