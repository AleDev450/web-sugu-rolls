import type { Metadata } from 'next';
import { Contacto } from '@/components/web/Contacto';
import { Pagina } from '@/components/web/Pagina';
import { metadataPagina } from '@/lib/metaServidor';

export function generateMetadata(): Promise<Metadata> {
  return metadataPagina('/contacto', {
    title: 'Contacto',
    description:
      'Teléfono, WhatsApp, correo y horario de atención de Sugu Rolls. Delivery en Lima.',
  });
}

export default function ContactoPage() {
  return (
    <Pagina>
      <Contacto />
    </Pagina>
  );
}
