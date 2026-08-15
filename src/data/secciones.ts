/**
 * Contenido editable de cada sección de la web.
 *
 * Es la fuente de verdad cuando no hay base de datos; cuando la hay, el panel
 * (/admin/paginas) escribe sobre la tabla `page_sections` y estos valores solo
 * sirven de respaldo. Los componentes leen siempre de aquí a través de
 * `traerSecciones()`, así que agregar un campo es agregarlo en los dos sitios.
 */

export type SeccionId =
  | 'hero'
  | 'accesos'
  | 'favoritos'
  | 'paquetes'
  | 'catering'
  | 'juego'
  | 'nosotros'
  | 'testimonios'
  | 'contacto';

/** Páginas que agrupan secciones. `inicio` es la portada. */
export type PaginaId = 'inicio' | 'carta' | 'paquetes' | 'catering' | 'promociones' | 'nosotros' | 'contacto';

export interface Seccion {
  id: SeccionId;
  /** dónde vive, para agrupar en el panel */
  pagina: PaginaId;
  /** nombre legible en el panel */
  titulo_panel: string;
  /** texto pequeño sobre el título */
  etiqueta: string;
  /** título principal */
  titulo: string;
  /** palabra final en rojo manuscrito */
  manuscrito: string;
  /** párrafo de apoyo */
  bajada: string;
  imagen: string;
  /** listas y datos propios de cada sección */
  extra: Record<string, unknown>;
}

export const SECCIONES: Record<SeccionId, Seccion> = {
  hero: {
    id: 'hero',
    pagina: 'inicio',
    titulo_panel: 'Portada — Cabecera',
    etiqueta: 'Makis peruanos · Preparados al momento',
    titulo: 'Makis que',
    manuscrito: 'te hacen feliz',
    bajada:
      'En Sugu Rolls combinamos frescura, sabor y pasión en cada roll. Makis preparados al momento con ingredientes seleccionados y mucho sabor para ti.',
    imagen: '/imagenes/web/hero-makis.webp',
    extra: {
      beneficios: ['Ingredientes frescos', 'Calidad premium', 'Delivery rápido'],
      boton_principal: 'Pedir ahora',
      boton_secundario: 'Ver nuestra carta',
    },
  },

  accesos: {
    id: 'accesos',
    pagina: 'inicio',
    titulo_panel: 'Portada — Accesos destacados',
    etiqueta: '',
    titulo: '',
    manuscrito: '',
    bajada: '',
    imagen: '',
    extra: {
      tarjetas: [
        {
          titulo: 'Nuestra Carta',
          texto: 'Descubre todos nuestros makis, bowls, entradas y bebidas.',
          imagen: '/imagenes/web/carta.webp',
          href: '/carta',
        },
        {
          titulo: 'Catering',
          texto:
            'Lleva el sabor de Sugu Rolls a reuniones, cumpleaños y ocasiones especiales.',
          imagen: '/imagenes/web/catering.webp',
          href: '/catering',
        },
      ],
      juego_titulo: 'Sugu Games',
      juego_texto: 'Juega, gana y disfruta de descuentos, makis gratis y premios exclusivos.',
      juego_boton: 'Jugar ahora',
    },
  },

  favoritos: {
    id: 'favoritos',
    pagina: 'inicio',
    titulo_panel: 'Portada — Nuestros Favoritos',
    etiqueta: 'Los más pedidos',
    titulo: 'Nuestros',
    manuscrito: 'Favoritos',
    bajada: '',
    imagen: '',
    extra: { enlace: 'Ver carta completa' },
  },

  paquetes: {
    id: 'paquetes',
    pagina: 'paquetes',
    titulo_panel: 'Promociones',
    etiqueta: 'Para compartir',
    titulo: 'Promociones para',
    manuscrito: 'compartir',
    bajada:
      'Elige el paquete perfecto para disfrutar con amigos, familia o compañeros de trabajo.',
    imagen: '',
    extra: {},
  },

  catering: {
    id: 'catering',
    pagina: 'catering',
    titulo_panel: 'Catering',
    etiqueta: 'Eventos y empresas',
    titulo: 'Catering',
    manuscrito: 'Sugu Rolls',
    bajada:
      'Creamos experiencias gastronómicas para reuniones corporativas, cumpleaños, celebraciones y eventos privados.',
    imagen: '/imagenes/web/catering.webp',
    extra: {
      beneficios: [
        'Bandejas personalizadas',
        'Opciones clásicas, premium y vegetarianas',
        'Entrega programada',
        'Presentación especial',
        'Atención para grupos grandes',
      ],
      boton: 'Solicitar cotización',
      dato_valor: '+150',
      dato_texto: 'eventos atendidos',
      /** fotos del carrusel; vacío = se muestra solo `imagen` */
      galeria: [] as string[],
    },
  },

  juego: {
    id: 'juego',
    pagina: 'promociones',
    titulo_panel: 'Sugu Games',
    etiqueta: 'Sugu Game',
    titulo: 'Juega y gana con',
    manuscrito: 'Sugu Rolls',
    bajada:
      'Combina ingredientes, completa pedidos y desbloquea premios exclusivos. Consigue descuentos, productos gratis y muchas sorpresas.',
    imagen: '/imagenes/ui/vista-principal.webp',
    extra: {
      pasos: [
        'Ingresa al juego.',
        'Alcanza el puntaje requerido.',
        'Compite por el primer lugar y gana el premio sorpresa.',
      ],
      boton_principal: 'Jugar ahora',
      boton_secundario: '¿Cómo funciona?',
    },
  },

  nosotros: {
    id: 'nosotros',
    pagina: 'nosotros',
    titulo_panel: 'Nosotros',
    etiqueta: 'Nosotros',
    titulo: 'Pasión en cada',
    manuscrito: 'roll',
    bajada:
      'En Sugu Rolls preparamos cada pedido al momento, combinando ingredientes frescos, recetas propias y mucha pasión. Buscamos que cada roll tenga sabor, personalidad y una presentación que sorprenda.',
    imagen: '/imagenes/web/nosotros.webp',
    extra: {
      estadisticas: [
        { valor: '+20', texto: 'variedades' },
        { valor: '100%', texto: 'ingredientes seleccionados' },
        { valor: 'Al momento', texto: 'preparación' },
        { valor: 'Lima', texto: 'delivery' },
      ],
    },
  },

  testimonios: {
    id: 'testimonios',
    pagina: 'inicio',
    titulo_panel: 'Portada — Testimonios',
    etiqueta: 'Testimonios',
    titulo: 'Lo que dicen',
    manuscrito: 'de nosotros',
    bajada: '',
    imagen: '',
    extra: {},
  },

  contacto: {
    id: 'contacto',
    pagina: 'contacto',
    titulo_panel: 'Contacto',
    etiqueta: 'Contacto',
    titulo: 'Estamos',
    manuscrito: 'para ti',
    bajada: 'Escríbenos para pedidos, cotizaciones o cualquier consulta.',
    imagen: '',
    extra: {},
  },
};

/** Etiquetas legibles de cada página, para agrupar en el panel. */
export const PAGINAS: { id: PaginaId; nombre: string; ruta: string }[] = [
  { id: 'inicio', nombre: 'Portada', ruta: '/' },
  { id: 'carta', nombre: 'Nuestra Carta', ruta: '/carta' },
  { id: 'paquetes', nombre: 'Promociones', ruta: '/paquetes' },
  { id: 'catering', nombre: 'Catering', ruta: '/catering' },
  { id: 'promociones', nombre: 'Sugu Games', ruta: '/promociones' },
  { id: 'nosotros', nombre: 'Nosotros', ruta: '/nosotros' },
  { id: 'contacto', nombre: 'Contacto', ruta: '/contacto' },
];

/** Lee una lista de `extra` con respaldo si el dato no existe o vino mal. */
export function lista<T>(extra: Record<string, unknown>, clave: string, respaldo: T[]): T[] {
  const v = extra?.[clave];
  return Array.isArray(v) && v.length > 0 ? (v as T[]) : respaldo;
}

/** Lee un texto de `extra` con respaldo. */
export function texto(extra: Record<string, unknown>, clave: string, respaldo: string): string {
  const v = extra?.[clave];
  return typeof v === 'string' && v.trim() ? v : respaldo;
}
