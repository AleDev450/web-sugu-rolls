import type { Metadata } from 'next';
import { PaginaLegal } from '@/components/web/PaginaLegal';

export const metadata: Metadata = {
  alternates: { canonical: '/cookies' },
  title: 'Política de cookies',
  description:
    'Qué cookies usa la web de Sugu Rolls, para qué sirven y cómo puedes desactivarlas desde tu navegador.',
};

export default function CookiesPage() {
  return <PaginaLegal titulo="Política de cookies" campo="cookies" />;
}
