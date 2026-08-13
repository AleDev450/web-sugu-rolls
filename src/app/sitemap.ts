import type { MetadataRoute } from 'next';
import { DOMINIO } from '@/data/site';

/**
 * sitemap.xml generado por Next en /sitemap.xml.
 *
 * Solo se listan las páginas públicas con contenido propio. Quedan fuera
 * /admin (privada), /cuenta (personal y sin nada que indexar) y /api.
 *
 * `priority` es una pista relativa dentro del propio sitio, no una nota:
 * la portada y la carta son las que queremos que Google trate como cabecera.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();

  const paginas: { ruta: string; prioridad: number; frecuencia: 'daily' | 'weekly' | 'monthly' }[] =
    [
      { ruta: '', prioridad: 1, frecuencia: 'weekly' },
      { ruta: '/carta', prioridad: 0.9, frecuencia: 'weekly' },
      { ruta: '/paquetes', prioridad: 0.8, frecuencia: 'weekly' },
      { ruta: '/promociones', prioridad: 0.8, frecuencia: 'daily' },
      { ruta: '/catering', prioridad: 0.7, frecuencia: 'monthly' },
      { ruta: '/nosotros', prioridad: 0.5, frecuencia: 'monthly' },
      { ruta: '/contacto', prioridad: 0.6, frecuencia: 'monthly' },
      { ruta: '/juego', prioridad: 0.7, frecuencia: 'monthly' },
    ];

  return paginas.map(({ ruta, prioridad, frecuencia }) => ({
    url: `${DOMINIO}${ruta}`,
    lastModified: ahora,
    changeFrequency: frecuencia,
    priority: prioridad,
  }));
}
