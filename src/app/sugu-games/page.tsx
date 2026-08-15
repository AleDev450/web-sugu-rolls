import type { Metadata } from 'next';
import { Juego } from '@/components/web/Juego';
import { Pagina } from '@/components/web/Pagina';
import { metadataPagina } from '@/lib/metaServidor';

export function generateMetadata(): Promise<Metadata> {
  return metadataPagina('/sugu-games', {
    title: 'Sugu Games',
    description:
      'Juega al Sugu Game, alcanza el puntaje y gana descuentos, makis gratis y premios exclusivos.',
  });
}

export default function SuguGamesPage() {
  return (
    <Pagina>
      <Juego />
    </Pagina>
  );
}
