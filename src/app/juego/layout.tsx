import type { Metadata, Viewport } from 'next';
import './juego.css';

export const metadata: Metadata = {
  alternates: { canonical: '/juego' },
  title: 'Juega y gana — Sugu Rolls',
  description:
    'Combina ingredientes, atiende a los clientes y desbloquea premios exclusivos de Sugu Rolls.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0d0a14',
};

export default function JuegoLayout({ children }: { children: React.ReactNode }) {
  return <div className="juego-root">{children}</div>;
}
