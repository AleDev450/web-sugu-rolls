import type { Metadata } from 'next';

/**
 * La cuenta es personal: no hay nada que indexar y sí datos que no deben
 * acabar en un resultado de búsqueda. `noindex` lo deja fuera del índice
 * aunque alguien enlace la página desde fuera (robots.txt solo pide no
 * rastrear; esto es lo que de verdad impide que aparezca).
 */
export const metadata: Metadata = {
  title: 'Mi cuenta',
  description: 'Tus pedidos, tus puntos del Sugu Club y tus canjes.',
  robots: { index: false, follow: false },
};

export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
