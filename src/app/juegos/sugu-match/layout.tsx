import type { Viewport } from 'next';
import { Baloo_2 } from 'next/font/google';
import './match.css';

/**
 * Sugu Match ocupa la pantalla entera y no lleva la cabecera de la web: es una
 * partida, no una página. Por eso tiene su propio layout, igual que `/juego` y
 * `/juegos/sugu-maki-maze`.
 */

/**
 * Tipografía del juego. Baloo 2 es redonda y con mucho grosor disponible, que
 * es justo lo que pide una estética kawaii: los marcadores tienen que leerse
 * de un vistazo a 40px de un móvil sin parecer una hoja de cálculo.
 */
const sugu = Baloo_2({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-sugu',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#8fd3f4',
};

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return <div className={`match-root ${sugu.variable}`}>{children}</div>;
}
