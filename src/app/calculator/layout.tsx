import type { Metadata, Viewport } from 'next';

/**
 * La caja de feria no es una página de la web: no se enlaza desde ningún
 * menú, no entra al sitemap y aquí se le dice a los buscadores que no la
 * indexen ni sigan sus enlaces. Se llega escribiendo /calculator y punto.
 *
 * No es una medida de seguridad —cualquiera con la URL entra—, solo evita
 * que la caja aparezca en Google. Si algún día maneja plata de verdad, toca
 * ponerle sesión como /admin.
 */
export const metadata: Metadata = {
  title: 'Caja — Sugu Rolls',
  robots: { index: false, follow: false, nocache: true },
};

/*
 * Sin zoom y a ancho de pantalla: se opera con el pulgar y un doble toque
 * accidental no debe agrandar la interfaz en medio de un cobro.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050505',
};

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
