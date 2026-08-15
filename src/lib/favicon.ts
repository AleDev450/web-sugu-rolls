import { traerMetaSitio } from './metaServidor';

/** Favicon de fábrica, empaquetado con el sitio (`/public/favicon-defecto.ico`). */
const DEFECTO = '/favicon-defecto.ico';

/**
 * Sirve el favicon guardado desde el panel, con una URL que NUNCA cambia.
 *
 * En Vercel el sistema de archivos es de solo lectura en producción, así que
 * el panel no puede "escribir" un archivo nuevo en `/public`. En vez de eso,
 * el favicon vive en el almacén de Supabase bajo una ruta FIJA
 * (`secciones/favicon`, ver `subirImagenIdentidad`), y esta función lo relee
 * en cada visita y retransmite esos bytes bajo `/icon.png` o `/favicon.ico`
 * —las URL de verdad estables, que es lo que necesita Google—.
 *
 * Sin favicon configurado, o si Supabase no responde, cae al de fábrica: la
 * pestaña nunca se queda sin icono por un fallo de red.
 */
export async function servirFavicon(urlPeticion: string): Promise<Response> {
  const ajustes = await traerMetaSitio();

  if (!ajustes.seo_favicon) {
    return Response.redirect(new URL(DEFECTO, urlPeticion), 307);
  }

  try {
    const remoto = await fetch(ajustes.seo_favicon, { next: { revalidate: 300 } });
    if (!remoto.ok) throw new Error('El almacén no devolvió el favicon');

    const bytes = await remoto.arrayBuffer();
    const tipo = remoto.headers.get('content-type') || 'image/png';

    return new Response(bytes, {
      headers: {
        'Content-Type': tipo,
        // corto + stale-while-revalidate: un reemplazo del panel se nota
        // pronto, sin pedirle a Supabase el archivo en cada visita
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch {
    return Response.redirect(new URL(DEFECTO, urlPeticion), 307);
  }
}
