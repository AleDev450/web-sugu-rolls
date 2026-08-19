import type { Viewport } from 'next';
import { Press_Start_2P } from 'next/font/google';
import './maze.css';

/**
 * Sugu Maki Maze ocupa la pantalla entera y no lleva la cabecera de la web:
 * es una recreativa, no una página. Por eso tiene su propio layout, igual que
 * `/juego`.
 */

/**
 * Tipografía de recreativa. Solo se usa en marcadores, títulos y botones del
 * juego —nunca en textos largos, que serían ilegibles— y se expone como
 * variable CSS para que `maze.css` la aplique donde toca.
 */
const arcade = Press_Start_2P({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-arcade',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050505',
};

export default function MazeLayout({ children }: { children: React.ReactNode }) {
  return <div className={`maze-root ${arcade.variable}`}>{children}</div>;
}
