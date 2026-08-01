/**
 * Datos de la marca y navegación.
 *
 * Todo lo editable de la web vive en /src/data. Cuando exista la API, estos
 * archivos se sustituyen por las llamadas correspondientes sin tocar la UI.
 */

export const SITE = {
  nombre: 'Sugu Rolls',
  eslogan: 'Makis que te hacen feliz',
  descripcion:
    'Makis preparados al momento con ingredientes frescos, recetas propias y mucho sabor.',

  telefono: '+51 999 123 456',
  /** solo dígitos, para los enlaces de WhatsApp */
  whatsapp: '51999123456',
  correo: 'hola@sugurolls.com.pe',
  direccion: 'Lima, Perú',
  horario: 'Lunes a domingo: 12:00 p. m. a 11:00 p. m.',

  redes: {
    instagram: 'https://instagram.com/sugurolls',
    facebook: 'https://facebook.com/sugurolls',
    tiktok: 'https://tiktok.com/@sugurolls',
  },

  /** Ruta del juego dentro de este mismo proyecto. */
  juegoUrl: '/juego',
} as const;

/** Arma un enlace de WhatsApp con mensaje predefinido. */
export function whatsappUrl(mensaje: string): string {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

export const NAV = [
  { label: 'Inicio', href: '/' },
  { label: 'Nuestra Carta', href: '/carta' },
  { label: 'Paquetes', href: '/#paquetes' },
  { label: 'Catering', href: '/catering' },
  { label: 'Promociones', href: '/#juego' },
  { label: 'Nosotros', href: '/#nosotros' },
  { label: 'Contacto', href: '/#contacto' },
] as const;

export const FOOTER_LINKS = {
  rapidos: [
    { label: 'Nuestra Carta', href: '/carta' },
    { label: 'Paquetes', href: '/#paquetes' },
    { label: 'Catering', href: '/catering' },
    { label: 'Juega y gana', href: '/juego' },
  ],
  ayuda: [
    { label: 'Preguntas frecuentes', href: '/#contacto' },
    { label: 'Zonas de delivery', href: '/#contacto' },
    { label: 'Términos y condiciones', href: '/terminos' },
    { label: 'Política de privacidad', href: '/privacidad' },
  ],
  // dos enlaces pueden apuntar al mismo ancla, así que la key va por label

} as const;
