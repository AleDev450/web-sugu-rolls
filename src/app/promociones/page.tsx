import type { Metadata } from 'next';
import { Pagina } from '@/components/web/Pagina';
import { Paquetes } from '@/components/web/Paquetes';

export const metadata: Metadata = {
  alternates: { canonical: '/promociones' },
  title: 'Promociones para compartir',
  description:
    'Sugu Box Personal, Dúo y Party: makis para compartir con amigos, familia o compañeros de trabajo.',
};

export default function PromocionesPage() {
  return (
    <Pagina>
      <Paquetes />
    </Pagina>
  );
}
