import { DOMINIO } from '@/data/site';
import { traerProductosServidor } from '@/lib/catalogoServidor';

const urlAbsoluta = (ruta: string) => (ruta.startsWith('http') ? ruta : `${DOMINIO}${ruta}`);

/**
 * JSON-LD de `/carta`: un `Product` por cada plato activo (para que Google
 * pueda mostrar precio y disponibilidad en el resultado) y el
 * `BreadcrumbList` de la página.
 *
 * No hay una URL propia por producto —la carta no tiene fichas
 * individuales—, así que `offers.url` apunta a `/carta`: es ahí donde ese
 * producto de verdad se puede pedir.
 */
export async function CartaJsonLd() {
  const productos = await traerProductosServidor();
  if (productos.length === 0) return null;

  const datos = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: DOMINIO },
          { '@type': 'ListItem', position: 2, name: 'Nuestra Carta', item: `${DOMINIO}/carta` },
        ],
      },
      {
        '@type': 'ItemList',
        itemListElement: productos.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Product',
            name: p.nombre,
            description: p.descripcion,
            image: urlAbsoluta(p.imagen),
            sku: p.slug,
            category: p.categoria,
            offers: {
              '@type': 'Offer',
              price: p.precio.toFixed(2),
              priceCurrency: 'PEN',
              availability: 'https://schema.org/InStock',
              url: `${DOMINIO}/carta`,
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
