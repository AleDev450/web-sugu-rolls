import type { Metadata } from 'next';
import { PaginaLegal } from '@/components/web/PaginaLegal';

export const metadata: Metadata = {
  alternates: { canonical: '/terminos' },
  title: 'Términos y condiciones',
  description:
    'Condiciones de uso de la web, los pedidos, el programa de puntos Sugu Club y el juego de Sugu Rolls.',
};

export default function TerminosPage() {
  return <PaginaLegal titulo="Términos y condiciones" campo="terminos" />;
}
