import type { Metadata } from 'next';
import { CartaCliente } from '@/components/web/CartaCliente';
import { CartaJsonLd } from '@/components/web/CartaJsonLd';
import { Pagina } from '@/components/web/Pagina';
import { metadataPagina } from '@/lib/metaServidor';

export function generateMetadata(): Promise<Metadata> {
  return metadataPagina('/carta', {
    title: 'Nuestra Carta',
    description:
      'Todos nuestros makis, bowls, entradas y bebidas. Preparados al momento con ingredientes frescos.',
  });
}

export default function CartaPage() {
  return (
    <Pagina>
      <CartaJsonLd />
      <CartaCliente />
    </Pagina>
  );
}
