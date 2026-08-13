import type { Metadata } from 'next';
import { Pagina } from '@/components/web/Pagina';
import { Paquetes } from '@/components/web/Paquetes';

export const metadata: Metadata = {
  alternates: { canonical: '/paquetes' },
  title: 'Paquetes para compartir',
  description:
    'Sugu Box Personal, Dúo y Party: makis para compartir con amigos, familia o compañeros de trabajo.',
};

export default function PaquetesPage() {
  return (
    <Pagina>
      <Paquetes />
    </Pagina>
  );
}
