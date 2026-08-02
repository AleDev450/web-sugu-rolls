'use client';

import { useEffect, useState } from 'react';
import { SECCIONES, type Seccion, type SeccionId } from '@/data/secciones';
import { traerSecciones } from '@/lib/contenido';

/**
 * Contenido de una sección. Arranca con el texto local y lo cambia por el del
 * panel cuando responde la base de datos: nunca hay un hueco mientras carga.
 *
 * La respuesta se guarda entre componentes para no pedir la misma tabla una
 * vez por sección.
 */
let cache: Record<SeccionId, Seccion> | null = null;
let enVuelo: Promise<Record<SeccionId, Seccion>> | null = null;

function cargar(): Promise<Record<SeccionId, Seccion>> {
  if (cache) return Promise.resolve(cache);
  if (!enVuelo) {
    enVuelo = traerSecciones().then((s) => {
      cache = s;
      enVuelo = null;
      return s;
    });
  }
  return enVuelo;
}

export function useSeccion(id: SeccionId): Seccion {
  const [seccion, setSeccion] = useState<Seccion>(cache?.[id] ?? SECCIONES[id]);

  useEffect(() => {
    let vivo = true;
    void cargar().then((todas) => {
      if (vivo) setSeccion(todas[id]);
    });
    return () => {
      vivo = false;
    };
  }, [id]);

  return seccion;
}
