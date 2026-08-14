import type { Metadata } from 'next';
import { LibroReclamaciones } from '@/components/web/LibroReclamaciones';

export const metadata: Metadata = {
  alternates: { canonical: '/libro-de-reclamaciones' },
  title: 'Libro de Reclamaciones',
  description:
    'Registra tu queja o reclamo sobre un pedido de Sugu Rolls. Libro de Reclamaciones virtual conforme al Código de Protección y Defensa del Consumidor.',
};

export default function LibroDeReclamacionesPage() {
  return <LibroReclamaciones />;
}
