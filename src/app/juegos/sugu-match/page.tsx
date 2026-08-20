import type { Metadata } from 'next';
import { metadataPagina } from '@/lib/metaServidor';
import { GameLoader } from './components/GameLoader';

export function generateMetadata(): Promise<Metadata> {
  return metadataPagina('/juegos/sugu-match', {
    title: 'Sugu Match',
    description:
      'Junta makis, forma combos y desata el Rainbow Maki. El Match-3 de Sugu Rolls: niveles, objetivos, boosters y mucho sushi kawaii.',
  });
}

export default function SuguMatchPage() {
  return <GameLoader />;
}
