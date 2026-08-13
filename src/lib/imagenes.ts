'use client';

import { getSupabase } from '@/lib/supabase/client';

/**
 * Subida de imágenes de productos.
 *
 * El archivo NO se sube tal cual: antes se recorta al formato de la tarjeta y
 * se recomprime en el navegador. Un móvil actual hace fotos de 4000x3000 y 5 MB;
 * subir eso significa que cada visita a la carta descarga megas para pintar una
 * tarjeta de 300 px, y en datos móviles se nota muchísimo.
 *
 * Al procesarlo aquí, la recomendación de tamaño deja de ser algo que el
 * usuario tenga que recordar: el panel la garantiza siempre.
 */

/** Medidas de destino: 4:3, el aspecto exacto de la tarjeta de producto. */
export const IMAGEN_PRODUCTO = {
  ancho: 1200,
  alto: 900,
  /*
   * 0.82 es el punto donde WebP deja de mejorar a la vista pero sigue
   * bajando de peso. Por encima de 0.9 el archivo se dispara sin que nadie
   * note la diferencia en una foto de comida.
   */
  calidad: 0.82,
  /** tope de entrada; lo que se sube después pesa una fracción de esto */
  maxEntradaMB: 12,
} as const;

/**
 * Recorta al centro en 4:3 y reescala a 1200x900.
 *
 * Se recorta en vez de deformar: una foto vertical de un maki estirada a 4:3
 * queda ridícula, y la tarjeta usa `object-cover`, así que el recorte iba a
 * pasar igual — mejor hacerlo aquí y no cargar píxeles que nunca se ven.
 */
async function prepararImagen(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);

  const { ancho, alto, calidad } = IMAGEN_PRODUCTO;
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo procesar la imagen.');

  // escala de "cubrir": la dimensión que sobra se recorta simétricamente
  const escala = Math.max(ancho / bitmap.width, alto / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (ancho - w) / 2, (alto - h) / 2, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    lienzo.toBlob(resolve, 'image/webp', calidad)
  );
  if (!blob) throw new Error('No se pudo comprimir la imagen.');
  return blob;
}

/** Nombre de archivo estable y sin sorpresas a partir del texto que sea. */
function aSlug(texto: string): string {
  return (
    texto
      .normalize('NFD')
      // NFD separa la tilde de la letra; este rango son esas tildes sueltas
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'producto'
  );
}

export interface ResultadoSubida {
  url: string;
  /** peso final en KB, para poder enseñárselo a quien sube */
  pesoKB: number;
}

/**
 * Procesa y sube la imagen. Devuelve la URL pública que se guarda en
 * `products.imagen`.
 */
export async function subirImagenProducto(
  archivo: File,
  nombreBase: string
): Promise<ResultadoSubida> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase no está configurado.');

  if (!archivo.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen.');
  }
  if (archivo.size > IMAGEN_PRODUCTO.maxEntradaMB * 1024 * 1024) {
    throw new Error(`La imagen no puede pasar de ${IMAGEN_PRODUCTO.maxEntradaMB} MB.`);
  }

  const blob = await prepararImagen(archivo);

  /*
   * El sufijo de tiempo evita dos problemas a la vez: que dos productos con
   * nombre parecido se pisen, y que al reemplazar una foto siga viéndose la
   * anterior por la caché del navegador y de la CDN.
   */
  const ruta = `${aSlug(nombreBase)}-${Date.now()}.webp`;

  const { error } = await sb.storage.from('productos').upload(ruta, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;

  const { data } = sb.storage.from('productos').getPublicUrl(ruta);
  return { url: data.publicUrl, pesoKB: Math.round(blob.size / 1024) };
}
