import type { Metadata } from 'next';
import { CartaCliente } from '@/components/web/CartaCliente';
import { Pagina } from '@/components/web/Pagina';

export const metadata: Metadata = {
  alternates: { canonical: '/carta' },
  title: 'Nuestra Carta',
  description:
    'Todos nuestros makis, bowls, entradas y bebidas. Preparados al momento con ingredientes frescos.',
};

export default function CartaPage() {
  return (
    <Pagina>
      <CartaCliente />
    </Pagina>
  );
}
