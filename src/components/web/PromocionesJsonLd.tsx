import { DOMINIO } from '@/data/site';
import { traerPaquetesServidor } from '@/lib/catalogoServidor';

const urlAbsoluta = (ruta: string) => (ruta.startsWith('http') ? ruta : `${DOMINIO}${ruta}`);

/**
 * JSON-LD de `/promociones`: un `Product` por cada promoción activa y el
 * `BreadcrumbList` de la página. Mismo criterio que `CartaJsonLd` — sin
 * ficha propia por promoción, `offers.url` apunta a `/promociones`.
 */
export async function PromocionesJsonLd() {
  const paquetes = await traerPaquetesServidor();
  if (paquetes.length === 0) return null;

  const datos = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: DOMINIO },
          { '@type': 'ListItem', position: 2, name: 'Promociones', item: `${DOMINIO}/promociones` },
        ],
      },
      {
        '@type': 'ItemList',
        itemListElement: paquetes.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Product',
            name: p.nombre,
            description: p.ideal,
            image: urlAbsoluta(p.imagen),
            sku: p.slug,
            offers: {
              '@type': 'Offer',
              price: p.precio.toFixed(2),
              priceCurrency: 'PEN',
              availability: 'https://schema.org/InStock',
              url: `${DOMINIO}/promociones`,
            },
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(datos).replace(/</g, '\\u003c') }}
    />
  );
}
