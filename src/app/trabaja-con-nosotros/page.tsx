import type { Metadata } from 'next';
import { TrabajaConNosotros } from '@/components/web/TrabajaConNosotros';

export const metadata: Metadata = {
  alternates: { canonical: '/trabaja-con-nosotros' },
  title: 'Trabaja con nosotros',
  description: 'Postula a Sugu Rolls: deja tus datos y adjunta tu CV.',
};

export default function TrabajaConNosotrosPage() {
  return <TrabajaConNosotros />;
}
