import type { Metadata } from 'next';
import { Catering } from '@/components/web/Catering';
import { CateringForm } from '@/components/web/CateringForm';
import { Pagina } from '@/components/web/Pagina';
import { metadataPagina } from '@/lib/metaServidor';

export function generateMetadata(): Promise<Metadata> {
  return metadataPagina('/catering', {
    title: 'Catering',
    description:
      'Catering de makis para reuniones corporativas, cumpleaños y eventos privados en Lima.',
  });
}

export default function CateringPage() {
  return (
    <Pagina>
      <Catering />
      <CateringForm />
    </Pagina>
  );
}
