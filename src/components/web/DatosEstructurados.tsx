import { DOMINIO, SITE } from '@/data/site';
import { traerMetaSitio } from '@/lib/metaServidor';

const LOGO_POR_DEFECTO = `${DOMINIO}/imagenes/web/logo.png`;

/**
 * Datos estructurados (JSON-LD) para Google.
 *
 * Es lo que más mueve la aguja en un negocio local: sin esto Google solo ve
 * texto suelto; con esto entiende que hay un RESTAURANTE, con su teléfono,
 * su horario y su zona de reparto, y puede mostrarlo en el panel lateral de
 * la búsqueda y en Maps.
 *
 * Nombre, nombre alterno, logo y el resto de la identidad salen de
 * `/admin/seo` (vacíos = se usa lo del código, igual que el resto del
 * módulo). El teléfono, correo y dirección salen de `/admin/ajustes`
 * (`site_settings`), que es donde ya se editaban antes de esto.
 *
 * Va como componente de servidor async para que el JSON viaje ya en el
 * HTML: si se pintara desde el navegador, el rastreador podría no verlo.
 *
 * Referencia del vocabulario: https://schema.org/Restaurant
 */
export async function DatosEstructurados() {
  const ajustes = await traerMetaSitio();

  const nombre = ajustes.seo_nombre_sitio.trim() || ajustes.nombre.trim() || SITE.nombre;
  const nombreAlterno = ajustes.seo_nombre_alterno.trim() || undefined;
  const logo = ajustes.seo_logo.trim() || LOGO_POR_DEFECTO;
  const imagen = ajustes.meta_imagen.trim() || `${DOMINIO}/imagenes/web/hero-makis.webp`;
  const telefono = ajustes.telefono.trim() || SITE.telefono;
  const correo = ajustes.correo.trim() || SITE.correo;
  const redes = [
    ajustes.instagram || SITE.redes.instagram,
    ajustes.facebook || SITE.redes.facebook,
    ajustes.tiktok || SITE.redes.tiktok,
  ].filter(Boolean);

  const datos = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Restaurant',
        '@id': `${DOMINIO}/#restaurante`,
        name: nombre,
        url: DOMINIO,
        logo,
        image: imagen,
        description: SITE.descripcion,
        telephone: telefono,
        email: correo,
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
        sameAs: redes,
      },
      /*
       * Organization, aparte del Restaurant: Google usa este tipo para el
       * logo que sale junto al nombre del sitio en el resultado de
       * búsqueda y en el conocimiento de la marca, independiente del panel
       * de negocio local que arma el Restaurant de arriba.
       */
      {
        '@type': 'Organization',
        '@id': `${DOMINIO}/#organizacion`,
        name: nombre,
        alternateName: nombreAlterno,
        url: DOMINIO,
        logo,
        sameAs: redes,
      },
      {
        '@type': 'WebSite',
        '@id': `${DOMINIO}/#sitio`,
        url: DOMINIO,
        name: nombre,
        alternateName: nombreAlterno,
        inLanguage: 'es-PE',
        publisher: { '@id': `${DOMINIO}/#organizacion` },
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
