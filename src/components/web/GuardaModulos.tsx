'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { moduloActivo, traerAjustes } from '@/lib/contenido';

/**
 * Aplica las banderas de módulos del panel.
 *
 * Vive en el layout raíz y hace dos cosas:
 *
 *   1. Con `solo_juego`, manda cualquier ruta de la web a /juego. Es el modo
 *      campaña: la tienda queda en pausa y solo existe el juego.
 *   2. Si la ruta actual pertenece a un módulo apagado, devuelve a la portada.
 *
 * El panel (/admin) NUNCA se bloquea: es lo único desde donde se puede volver
 * a encender lo que se apagó, y dejarlo fuera del guardián evita quedarse sin
 * puerta de vuelta.
 *
 * Se comprueba en el cliente y no en un middleware para no pagar una consulta
 * a Supabase en cada petición: `traerAjustes` ya viene con respaldo local, así
 * que la respuesta es inmediata salvo la primera vez.
 */
export function GuardaModulos() {
  const ruta = usePathname();
  const router = useRouter();
  const [ajustes, setAjustes] = useState<Awaited<ReturnType<typeof traerAjustes>> | null>(null);

  useEffect(() => {
    void traerAjustes().then(setAjustes);
  }, []);

  useEffect(() => {
    if (!ajustes || !ruta) return;
    if (ruta.startsWith('/admin') || ruta.startsWith('/api')) return;

    if (ajustes.solo_juego) {
      if (!ruta.startsWith('/juego')) router.replace('/juego');
      return;
    }

    // la ruta exacta o su primer tramo: /carta y /carta/lo-que-sea
    const base = '/' + (ruta.split('/')[1] ?? '');
    if (!moduloActivo(ajustes, base)) router.replace('/');
  }, [ajustes, ruta, router]);

  return null;
}
