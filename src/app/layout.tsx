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

/*
 * Dinámica en vez de un objeto fijo: título, descripción e imagen se pueden
 * editar desde /admin/seo (tabla `site_settings`). Vacíos en la base = se
 * usa lo de aquí, así que un panel sin llenar no deja la web sin metadatos.
 */
export async function generateMetadata(): Promise<Metadata> {
  const ajustes = await traerMetaSitio();
  const titulo = ajustes.meta_titulo.trim() || TITULO_POR_DEFECTO;
  const descripcion = ajustes.meta_descripcion.trim() || DESCRIPCION_POR_DEFECTO;
  const imagen = ajustes.meta_imagen.trim() || IMAGEN_POR_DEFECTO;

  return {
    /*
     * Base de todas las URL relativas de metadatos. Debe ser el dominio real:
     * de aquí salen las canónicas y las imágenes que Google y las redes leen.
     */
    metadataBase: new URL(DOMINIO),
    title: {
      default: titulo,
      template: `%s · ${ajustes.nombre || SITE.nombre}`,
    },
    description: descripcion,
    applicationName: ajustes.nombre || SITE.nombre,
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
    authors: [{ name: ajustes.nombre || SITE.nombre, url: DOMINIO }],
    creator: ajustes.nombre || SITE.nombre,
    publisher: ajustes.nombre || SITE.nombre,

    // canónica de la portada; cada página añade la suya
    alternates: { canonical: '/' },

    /*
     * Sin `index` explícito Google decide solo, pero declararlo evita sustos
     * si algún proxy mete un `noindex` por defecto. `max-image-preview: large`
     * es lo que permite que salga la foto grande en los resultados.
     */
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },

    openGraph: {
      type: 'website',
      locale: 'es_PE',
      url: DOMINIO,
      siteName: ajustes.nombre || SITE.nombre,
      title: titulo,
      description: descripcion,
      images: [
        {
          url: imagen,
          width: 1200,
          height: 630,
          alt: ajustes.nombre || SITE.nombre,
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
     * Los iconos NO se declaran aquí: Next los detecta por convención desde
     * src/app/icon.png y src/app/apple-icon.png, y genera las etiquetas con un
     * hash en la URL para que un cambio de logo se propague sin caché vieja.
     * Declararlos a mano además pisaría esa detección.
     */

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
