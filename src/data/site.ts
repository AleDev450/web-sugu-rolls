/**
 * Datos de la marca y navegación.
 *
 * Todo lo editable de la web vive en /src/data. Cuando exista la API, estos
 * archivos se sustituyen por las llamadas correspondientes sin tocar la UI.
 */

/**
 * Dominio público. Es la base de las URL canónicas, el sitemap y los datos
 * estructurados, así que tiene que ser EXACTAMENTE el dominio que sirve la
 * web: si Google ve una canónica hacia otro dominio, no indexa este.
 */
export const DOMINIO = 'https://sugurolls.com';

export const SITE = {
  nombre: 'Sugu Rolls',
  eslogan: 'Makis que te hacen feliz',
  descripcion:
    'Makis preparados al momento con ingredientes frescos, recetas propias y mucho sabor.',

  telefono: '+51 997 516 391',
  /** solo dígitos, para los enlaces de WhatsApp */
  whatsapp: '51997516391',
  correo: 'Sugurollsperu@gmail.com',
  direccion: 'Juan Pablo Fernandini 1195, Pueblo Libre 15084',

  /**
   * La misma dirección despiezada. Google necesita las partes por separado
   * en los datos estructurados para poder ubicar el local en el mapa; con la
   * cadena entera solo puede mostrarla como texto.
   */
  domicilio: {
    calle: 'Juan Pablo Fernandini 1195',
    distrito: 'Pueblo Libre',
    ciudad: 'Lima',
    region: 'Lima',
    codigoPostal: '15084',
    pais: 'PE',
  },
  horario: 'Lunes a domingo: 12:00 p. m. a 11:00 p. m.',

  redes: {
    instagram: 'https://instagram.com/sugurolls',
    facebook: 'https://facebook.com/sugurolls',
    tiktok: 'https://tiktok.com/@sugurolls',
  },

  /** Ruta del juego dentro de este mismo proyecto. */
  juegoUrl: '/juego',
} as const;

/**
 * Arma un enlace de WhatsApp con mensaje predefinido.
 *
 * `numero` permite pasar el que está guardado en el panel; sin él usa el del
 * código, que solo debería salir si la base no responde.
 */
export function whatsappUrl(mensaje: string, numero?: string): string {
  return `https://wa.me/${numero || SITE.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

/** Cada entrada es una página propia. */
export const NAV = [
  { label: 'Inicio', href: '/' },
  { label: 'Nuestra Carta', href: '/carta' },
  { label: 'Paquetes', href: '/paquetes' },
  { label: 'Catering', href: '/catering' },
  { label: 'Promociones', href: '/promociones' },
  { label: 'Nosotros', href: '/nosotros' },
  { label: 'Contacto', href: '/contacto' },
] as const;

export const FOOTER_LINKS = {
  rapidos: [
    { label: 'Nuestra Carta', href: '/carta' },
    { label: 'Paquetes', href: '/paquetes' },
    { label: 'Catering', href: '/catering' },
    { label: 'Juega y gana', href: '/juego' },
  ],
  ayuda: [
    { label: 'Zonas de delivery', href: '/contacto' },
    { label: 'Términos y condiciones', href: '/terminos' },
    { label: 'Política de privacidad', href: '/privacidad' },
  ],
  // dos enlaces pueden apuntar al mismo ancla, así que la key va por label

} as const;
