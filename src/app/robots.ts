import type { MetadataRoute } from 'next';
import { DOMINIO } from '@/data/site';

/**
 * robots.txt generado por Next en /robots.txt.
 *
 * El panel y las rutas de API quedan fuera del índice: no aportan nada en una
 * búsqueda y /admin no debe aparecer nunca en resultados. No es una medida de
 * seguridad —el permiso real lo dan las políticas RLS—, solo evita que se
 * indexe una pantalla de login.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/', '/cuenta'],
      },
    ],
    sitemap: `${DOMINIO}/sitemap.xml`,
    host: DOMINIO,
  };
}
