import type { Metadata } from 'next';
import { Cart } from '@/components/web/Cart';
import { Catering } from '@/components/web/Catering';
import { CateringForm } from '@/components/web/CateringForm';
import { Footer } from '@/components/web/Footer';
import { Header } from '@/components/web/Header';
import { WhatsappFab } from '@/components/web/WhatsappFab';

export const metadata: Metadata = {
  title: 'Catering',
  description:
    'Catering de makis para reuniones corporativas, cumpleaños y eventos privados en Lima.',
};

export default function CateringPage() {
  return (
    <>
      <Header />
      <main className="pt-24">
        <Catering />
        <CateringForm />
      </main>
      <Footer />
      <Cart />
      <WhatsappFab />
    </>
  );
}
