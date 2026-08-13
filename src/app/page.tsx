import { Accesos } from '@/components/web/Accesos';
import { Favoritos } from '@/components/web/Favoritos';
import { Hero } from '@/components/web/Hero';
import { Pagina } from '@/components/web/Pagina';

/**
 * Portada: cabecera, las tres puertas de entrada, los favoritos y las
 * reseñas. El detalle de paquetes, catering, promociones, nosotros y
 * contacto vive en su propia página.
 */
export default function Page() {
  return (
    <Pagina>
      <Hero />
      <Accesos />
      <Favoritos />
    </Pagina>
  );
}
