import type { Metadata, Viewport } from 'next';

/**
 * Pantalla de cocina. Como la caja, no se enlaza desde ningún menú y se le
 * dice a los buscadores que no la indexen: se llega con el enlace que genera
 * la caja, que lleva la clave.
 */
export const metadata: Metadata = {
  title: 'Cocina — Sugu Rolls',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#050505',
};

export default function CocinaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
