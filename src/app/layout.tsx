import type { Metadata, Viewport } from 'next';
import { Inter, Caveat } from 'next/font/google';
import './globals.css';
import { DOMINIO, SITE } from '@/data/site';
import { traerMetaSitio } from '@/lib/metaServidor';
import { DatosEstructurados } from '@/components/web/DatosEstructurados';
import { GuardaModulos } from '@/components/web/GuardaModulos';

/** Texto corrido. */
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

/**
 * Trazo manuscrito para los títulos destacados ("te hacen feliz",
 * "Favoritos"). Caveat imita el pincel sin perder legibilidad.
 */
const brush = Caveat({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-brush',
  display: 'swap',
});

const TITULO_POR_DEFECTO = 'Sugu Rolls — Makis que te hacen feliz | Delivery de sushi en Lima';
const DESCRIPCION_POR_DEFECTO =
  'Makis preparados al momento con ingredientes frescos. Carta, paquetes para compartir, catering y delivery de sushi en Lima. Pide por WhatsApp y juega para ganar premios.';
const IMAGEN_POR_DEFECTO = '/imagenes/web/hero-makis.webp';
const PLANTILLA_POR_DEFECTO = '%s | Sugu Rolls';

/*
 * ISR, no estático puro ni SSR en cada visita: `/admin/seo` guarda en
 * Supabase, y sin esto el cambio solo se vería después de un redeploy (las
 * páginas se generan una vez, en el build). Con `revalidate` Next sirve la
 * versión ya generada y la refresca en segundo plano cuando pasan estos
 * segundos y llega una visita — la consulta a Supabase no se repite en cada
 * render, solo cuando toca refrescar. `traerMetaSitio` además cachea 60s por
 * su cuenta, para la tanda de páginas que comparten esta misma consulta.
 */
export const revalidate = 300;

/*
 * Dinámica en vez de un objeto fijo: identidad, título, descripción, imagen,
 * plantilla e index/follow se editan desde /admin/seo (tabla
 * `site_settings`). Vacíos en la base = se usa lo de aquí, así que un panel
 * sin llenar no deja la web sin metadatos.
 */
export async function generateMetadata(): Promise<Metadata> {
  const ajustes = await traerMetaSitio();
  const nombreSitio = ajustes.seo_nombre_sitio.trim() || ajustes.nombre.trim() || SITE.nombre;
  const titulo = ajustes.meta_titulo.trim() || TITULO_POR_DEFECTO;
  const descripcion = ajustes.meta_descripcion.trim() || DESCRIPCION_POR_DEFECTO;
  const imagen = ajustes.meta_imagen.trim() || IMAGEN_POR_DEFECTO;
  const plantilla = ajustes.seo_plantilla_titulo.trim() || PLANTILLA_POR_DEFECTO;

  return {
    /*
     * Base de todas las URL relativas de metadatos. Debe ser el dominio real:
     * de aquí salen las canónicas y las imágenes que Google y las redes leen.
     */
    metadataBase: new URL(DOMINIO),
    title: {
      default: titulo,
      template: plantilla,
    },
    description: descripcion,
    applicationName: nombreSitio,
    keywords: [
      'makis',
      'sushi',
      'delivery sushi Lima',
      'makis a domicilio',
      'sushi Lima',
      'catering sushi',
      'rolls',
      'Sugu Rolls',
    ],
    authors: [{ name: nombreSitio, url: DOMINIO }],
    creator: nombreSitio,
    publisher: nombreSitio,

    // canónica de la portada; cada página añade la suya
    alternates: { canonical: '/' },

    /*
     * Activados por defecto: sin fila en la base (o con Supabase caído),
     * `traerMetaSitio` ya devuelve `true` para los dos, así que un fallo de
     * conexión nunca le pide a Google que deje de indexar el sitio.
     * `max-image-preview: large` es lo que permite que salga la foto grande
     * en los resultados.
     */
    robots: {
      index: ajustes.seo_robots_index,
      follow: ajustes.seo_robots_follow,
      googleBot: {
        index: ajustes.seo_robots_index,
        follow: ajustes.seo_robots_follow,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },

    /*
     * `/icon.png` y `/favicon.ico` NO son archivos: son rutas de Next
     * (`src/app/icon.png/route.ts`) que leen el favicon guardado en
     * `site_settings.seo_favicon` y lo retransmiten. La URL es siempre la
     * misma aunque el admin reemplace el favicon, que es justo lo que hace
     * falta para que Google no siga mostrando una versión vieja en caché.
     */
    icons: {
      icon: '/icon.png',
      shortcut: '/favicon.ico',
      apple: '/icon.png',
    },

    openGraph: {
      type: 'website',
      locale: 'es_PE',
      url: DOMINIO,
      siteName: nombreSitio,
      title: titulo,
      description: descripcion,
      images: [
        {
          url: imagen,
          width: 1200,
          height: 630,
          alt: nombreSitio,
        },
      ],
    },

    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descripcion,
      images: [imagen],
    },

    /*
     * Verificación de Google Search Console. Se pega aquí el código que da
     * Search Console (método "etiqueta HTML") y se despliega; hasta entonces
     * la verificación se puede hacer igualmente por DNS.
     */
    // verification: { google: 'PEGA-AQUI-EL-CODIGO' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#050505',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${brush.variable}`}>
      <body className="font-sans">
        <DatosEstructurados />
        <GuardaModulos />
        {children}
      </body>
    </html>
  );
}
