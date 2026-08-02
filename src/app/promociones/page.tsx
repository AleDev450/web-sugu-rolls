import type { Metadata } from 'next';
import { Juego } from '@/components/web/Juego';
import { Pagina } from '@/components/web/Pagina';

export const metadata: Metadata = {
  title: 'Promociones y Juego',
  description:
    'Juega al Sugu Game, alcanza el puntaje y gana descuentos, makis gratis y premios exclusivos.',
};

export default function PromocionesPage() {
  return (
    <Pagina>
      <Juego />
    </Pagina>
  );
}
