import type { Metadata } from 'next';
import { Accesos } from '@/components/web/Accesos';
import { Favoritos } from '@/components/web/Favoritos';
import { Portada } from '@/components/web/Portada';
import { Pagina } from '@/components/web/Pagina';
import { metadataPagina } from '@/lib/metaServidor';

/** Sin override en /admin/seo → SEO por página, la portada usa lo del layout raíz tal cual. */
export function generateMetadata(): Promise<Metadata> {
  return metadataPagina('/');
}

/**
 * Portada: cabecera, las tres puertas de entrada, los favoritos y las
 * reseñas. El detalle de paquetes, catering, promociones, nosotros y
 * contacto vive en su propia página.
 */
export default function Page() {
  return (
    <Pagina>
      {/* el slider manda si hay diapositivas; si no, se queda el hero */}
      <Portada />
      <Accesos />
      <Favoritos />
    </Pagina>
  );
}
