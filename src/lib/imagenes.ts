'use client';

import { getSupabase } from '@/lib/supabase/client';

/**
 * Subida de imágenes del contenido (productos, paquetes, secciones).
 *
 * El archivo NO se sube tal cual: antes se recorta al formato donde se va a
 * ver y se recomprime en el navegador. Un móvil actual hace fotos de 4000x3000
 * y 5 MB; subir eso significa que cada visita descarga megas para pintar una
 * tarjeta de 300 px, y en datos móviles se nota muchísimo.
 *
 * Al procesarlo aquí, la medida recomendada deja de ser algo que haya que
 * recordar: el panel la garantiza siempre.
 */

/**
 * Un destino de imagen: dónde se guarda y con qué forma.
 *
 * Las medidas salen del sitio donde se muestra cada una. Se calculan para el
 * caso más exigente —móvil de pantalla densa— porque es el que más resolución
 * pide; más grande sería peso que nadie llega a ver.
 */
export interface DestinoImagen {
  carpeta: string;
  ancho: number;
  alto: number;
}

export const DESTINOS = {
  /** Tarjeta de producto: 4:3 */
  producto: { carpeta: 'productos', ancho: 1200, alto: 900 },
  /** Tarjeta de paquete: 16:10 */
  paquete: { carpeta: 'paquetes', ancho: 1280, alto: 800 },
  /** Fotos de sección (nosotros, catering…): 5:4, la más común del sitio */
  seccion: { carpeta: 'secciones', ancho: 1400, alto: 1120 },
  /** Hero de portada: cuadrada */
  hero: { carpeta: 'secciones', ancho: 1400, alto: 1400 },
} as const satisfies Record<string, DestinoImagen>;

export type TipoImagen = keyof typeof DESTINOS;

/**
 * 0.82 es el punto donde WebP deja de mejorar a la vista pero sigue bajando
 * de peso. Por encima de 0.9 el archivo se dispara sin que nadie note la
 * diferencia en una foto de comida.
 */
const CALIDAD = 0.82;

/** Tope de entrada; lo que se sube después pesa una fracción de esto. */
export const MAX_ENTRADA_MB = 12;

/**
 * Recorta al centro con la proporción del destino y reescala.
 *
 * Se recorta en vez de deformar: una foto vertical estirada a 4:3 queda
 * ridícula, y como el sitio usa `object-cover`, el recorte iba a ocurrir
 * igual — mejor hacerlo aquí y no cargar píxeles que nunca se ven.
 */
async function prepararImagen(archivo: File, destino: DestinoImagen): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);

  const { ancho, alto } = destino;
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo procesar la imagen.');

  const escala = Math.max(ancho / bitmap.width, alto / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (ancho - w) / 2, (alto - h) / 2, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    lienzo.toBlob(resolve, 'image/webp', CALIDAD)
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
      .slice(0, 40) || 'imagen'
  );
}

export interface ResultadoSubida {
  url: string;
  /** peso final en KB, para poder enseñárselo a quien sube */
  pesoKB: number;
}

/**
 * Procesa y sube la imagen. Devuelve la URL pública que se guarda en el
 * campo correspondiente de la base.
 */
export async function subirImagen(
  archivo: File,
  nombreBase: string,
  tipo: TipoImagen = 'producto'
): Promise<ResultadoSubida> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase no está configurado.');

  if (!archivo.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen.');
  }
  if (archivo.size > MAX_ENTRADA_MB * 1024 * 1024) {
    throw new Error(`La imagen no puede pasar de ${MAX_ENTRADA_MB} MB.`);
  }

  const destino = DESTINOS[tipo];
  const blob = await prepararImagen(archivo, destino);

  /*
   * El sufijo de tiempo evita dos problemas a la vez: que dos elementos con
   * nombre parecido se pisen, y que al reemplazar una foto siga viéndose la
   * anterior por la caché del navegador y de la CDN.
   */
  const ruta = `${destino.carpeta}/${aSlug(nombreBase)}-${Date.now()}.webp`;

  const { error } = await sb.storage.from('imagenes').upload(ruta, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;

  const { data } = sb.storage.from('imagenes').getPublicUrl(ruta);
  return { url: data.publicUrl, pesoKB: Math.round(blob.size / 1024) };
}
