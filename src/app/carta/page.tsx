import type { Metadata } from 'next';
import { Cart } from '@/components/web/Cart';
import { CartaCliente } from '@/components/web/CartaCliente';
import { Footer } from '@/components/web/Footer';
import { Header } from '@/components/web/Header';
import { WhatsappFab } from '@/components/web/WhatsappFab';

export const metadata: Metadata = {
  title: 'Nuestra Carta',
  description:
    'Todos nuestros makis, bowls, entradas y bebidas. Preparados al momento con ingredientes frescos.',
};

export default function CartaPage() {
  return (
    <>
      <Header />
      <main className="pt-28 sm:pt-32">
        <CartaCliente />
      </main>
      <Footer />
      <Cart />
      <WhatsappFab />
    </>
  );
}
