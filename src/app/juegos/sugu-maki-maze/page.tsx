import type { Metadata } from 'next';
import { metadataPagina } from '@/lib/metaServidor';
import { GameLoader } from './components/GameLoader';

export function generateMetadata(): Promise<Metadata> {
  return metadataPagina('/juegos/sugu-maki-maze', {
    title: 'Sugu Maki Maze',
    description:
      'Recorre el laberinto con tu maki, recoge todo el arroz, esquiva al chile y al wasabi y desata el SUGU POWER. Un arcade de Sugu Rolls.',
  });
}

export default function SuguMakiMazePage() {
  return <GameLoader />;
}
