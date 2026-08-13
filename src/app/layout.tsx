import type { Metadata, Viewport } from 'next';
import { Inter, Caveat } from 'next/font/google';
import './globals.css';
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
  metadataBase: new URL('https://sugurolls.com.pe'),
  title: {
    default: 'Sugu Rolls — Makis que te hacen feliz',
    template: '%s · Sugu Rolls',
  },
  description:
    'Makis preparados al momento con ingredientes frescos y mucho sabor. Carta, paquetes para compartir, catering y delivery en Lima.',
  keywords: ['makis', 'sushi', 'delivery', 'Lima', 'Perú', 'catering', 'Sugu Rolls'],
  openGraph: {
    title: 'Sugu Rolls — Makis que te hacen feliz',
    description:
      'Frescura, sabor y pasión en cada roll. Delivery en Lima, paquetes para compartir y catering para tus eventos.',
    type: 'website',
    locale: 'es_PE',
  },
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
        <GuardaModulos />
        {children}
      </body>
    </html>
  );
}
