import type { Metadata } from 'next';
import { Pagina } from '@/components/web/Pagina';
import { Paquetes } from '@/components/web/Paquetes';
import { PromocionesJsonLd } from '@/components/web/PromocionesJsonLd';
import { metadataPagina } from '@/lib/metaServidor';

export function generateMetadata(): Promise<Metadata> {
  return metadataPagina('/promociones', {
    title: 'Promociones para compartir',
    description:
      'Sugu Box Personal, Dúo y Party: makis para compartir con amigos, familia o compañeros de trabajo.',
  });
}

export default function PromocionesPage() {
  return (
    <Pagina>
      <PromocionesJsonLd />
      <Paquetes />
    </Pagina>
  );
}
