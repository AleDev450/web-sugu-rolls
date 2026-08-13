import { DOMINIO, SITE } from '@/data/site';

/**
 * Datos estructurados (JSON-LD) para Google.
 *
 * Es lo que más mueve la aguja en un negocio local: sin esto Google solo ve
 * texto suelto; con esto entiende que hay un RESTAURANTE, con su teléfono,
 * su horario y su zona de reparto, y puede mostrarlo en el panel lateral de
 * la búsqueda y en Maps.
 *
 * Va como componente de servidor para que el JSON viaje ya en el HTML: si se
 * pintara desde el navegador, el rastreador podría no verlo.
 *
 * Referencia del vocabulario: https://schema.org/Restaurant
 */
export function DatosEstructurados() {
  const datos = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Restaurant',
        '@id': `${DOMINIO}/#restaurante`,
        name: SITE.nombre,
        description: SITE.descripcion,
        url: DOMINIO,
        telephone: SITE.telefono,
        email: SITE.correo,
        image: `${DOMINIO}/imagenes/web/hero-makis.webp`,
        logo: `${DOMINIO}/imagenes/web/logo.png`,
        // cocina y precio: alimentan los filtros de búsqueda de Google
        servesCuisine: ['Japonesa', 'Sushi', 'Makis'],
        priceRange: 'S/S/',
        address: {
          '@type': 'PostalAddress',
          streetAddress: SITE.domicilio.calle,
          // el distrito es lo que la gente busca de verdad ("sushi Pueblo Libre")
          addressLocality: SITE.domicilio.distrito,
          addressRegion: SITE.domicilio.region,
          postalCode: SITE.domicilio.codigoPostal,
          addressCountry: SITE.domicilio.pais,
        },
        areaServed: [
          { '@type': 'City', name: SITE.domicilio.ciudad },
          { '@type': 'AdministrativeArea', name: SITE.domicilio.distrito },
        ],
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: [
              'Monday',
              'Tuesday',
              'Wednesday',
              'Thursday',
              'Friday',
              'Saturday',
              'Sunday',
            ],
            opens: '12:00',
            closes: '23:00',
          },
        ],
        hasMenu: `${DOMINIO}/carta`,
        acceptsReservations: false,
        sameAs: [SITE.redes.instagram, SITE.redes.facebook, SITE.redes.tiktok].filter(Boolean),
      },
      {
        '@type': 'WebSite',
        '@id': `${DOMINIO}/#sitio`,
        url: DOMINIO,
        name: SITE.nombre,
        inLanguage: 'es-PE',
        publisher: { '@id': `${DOMINIO}/#restaurante` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // el contenido es nuestro y no lleva entrada de usuario; se escapa el
      // cierre de etiqueta por si algún texto lo incluyera algún día
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(datos).replace(/</g, '\\u003c'),
      }}
    />
  );
}
