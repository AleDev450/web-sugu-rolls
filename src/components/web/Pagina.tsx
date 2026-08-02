import type { ReactNode } from 'react';
import { Cart } from './Cart';
import { Footer } from './Footer';
import { Header } from './Header';
import { WhatsappFab } from './WhatsappFab';

/**
 * Envoltorio común de todas las páginas públicas: cabecera, carrito, pie y
 * botón de WhatsApp.
 *
 * No añade espacio superior a propósito: cada sección usa la clase `.section`,
 * cuyo padding ya deja sitio de sobra para el header fijo. Si se añadiera aquí
 * también, el hueco quedaría al doble.
 */
export function Pagina({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <Cart />
      <WhatsappFab />
    </>
  );
}
