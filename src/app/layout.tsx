import type { Metadata, Viewport } from 'next';
import { Inter, Caveat } from 'next/font/google';
import './globals.css';
import { DOMINIO, SITE } from '@/data/site';
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

export const metadata: Metadata = {
  /*
   * Base de todas las URL relativas de metadatos. Debe ser el dominio real:
   * de aquí salen las canónicas y las imágenes que Google y las redes leen.
   */
  metadataBase: new URL(DOMINIO),
  title: {
    default: 'Sugu Rolls — Makis que te hacen feliz | Delivery de sushi en Lima',
    template: '%s · Sugu Rolls',
  },
  description:
    'Makis preparados al momento con ingredientes frescos. Carta, paquetes para compartir, catering y delivery de sushi en Lima. Pide por WhatsApp y juega para ganar premios.',
  applicationName: SITE.nombre,
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
  authors: [{ name: SITE.nombre, url: DOMINIO }],
  creator: SITE.nombre,
  publisher: SITE.nombre,

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
    siteName: SITE.nombre,
    title: 'Sugu Rolls — Makis que te hacen feliz',
    description:
      'Frescura, sabor y pasión en cada roll. Delivery en Lima, paquetes para compartir y catering para tus eventos.',
    images: [
      {
        url: '/imagenes/web/hero-makis.webp',
        width: 1200,
        height: 630,
        alt: 'Makis de Sugu Rolls',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Sugu Rolls — Makis que te hacen feliz',
    description: 'Delivery de sushi en Lima, paquetes para compartir y catering.',
    images: ['/imagenes/web/hero-makis.webp'],
  },

  icons: { icon: '/favicon.ico', apple: '/imagenes/web/logo.png' },

  /*
   * Verificación de Google Search Console. Se pega aquí el código que da
   * Search Console (método "etiqueta HTML") y se despliega; hasta entonces
   * la verificación se puede hacer igualmente por DNS.
   */
  // verification: { google: 'PEGA-AQUI-EL-CODIGO' },
};

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
