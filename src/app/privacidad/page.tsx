import type { Metadata } from 'next';
import { PaginaLegal } from '@/components/web/PaginaLegal';

export const metadata: Metadata = {
  alternates: { canonical: '/privacidad' },
  title: 'Política de privacidad',
  description:
    'Qué datos recogemos, para qué los usamos y cómo puedes ejercer tus derechos en Sugu Rolls.',
};

export default function PrivacidadPage() {
  return <PaginaLegal titulo="Política de privacidad" campo="privacidad" />;
}
