import type { Metadata } from 'next';
import { Nosotros } from '@/components/web/Nosotros';
import { Pagina } from '@/components/web/Pagina';

export const metadata: Metadata = {
  alternates: { canonical: '/nosotros' },
  title: 'Nosotros',
  description:
    'Preparamos cada pedido al momento, con ingredientes frescos, recetas propias y mucha pasión.',
};

export default function NosotrosPage() {
  return (
    <Pagina>
      <Nosotros />
    </Pagina>
  );
}
