import { Accesos } from '@/components/web/Accesos';
import { Cart } from '@/components/web/Cart';
import { Catering } from '@/components/web/Catering';
import { Contacto } from '@/components/web/Contacto';
import { Favoritos } from '@/components/web/Favoritos';
import { Footer } from '@/components/web/Footer';
import { Header } from '@/components/web/Header';
import { Hero } from '@/components/web/Hero';
import { Juego } from '@/components/web/Juego';
import { Nosotros } from '@/components/web/Nosotros';
import { Paquetes } from '@/components/web/Paquetes';
import { Testimonios } from '@/components/web/Testimonios';
import { WhatsappFab } from '@/components/web/WhatsappFab';

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Accesos />
        <Favoritos />
        <Paquetes />
        <Catering />
        <Juego />
        <Nosotros />
        <Testimonios />
        <Contacto />
      </main>
      <Footer />
      <Cart />
      <WhatsappFab />
    </>
  );
}
