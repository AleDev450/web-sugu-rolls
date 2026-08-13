'use client';

import { useEffect, useState } from 'react';
import { traerAjustes, type AjustesSitio } from '@/lib/contenido';

/**
 * Ajustes del sitio (teléfono, horario, redes…) tal como están EN LA BASE.
 *
 * Existe porque el pie de página, el contacto y las redes leían las constantes
 * de `src/data/site.ts`, que están escritas en el código: el panel guardaba en
 * `site_settings` y esos bloques seguían mostrando lo de siempre. Ese era el
 * motivo real de "guardo en el dashboard y la web no se entera".
 *
 * La consulta se comparte entre todos los componentes: la primera llamada la
 * dispara y las demás se enganchan a la misma promesa, así que un pie, un
 * bloque de contacto y el botón de WhatsApp en la misma página no piden los
 * ajustes tres veces.
 */

let cache: AjustesSitio | null = null;
let enVuelo: Promise<AjustesSitio> | null = null;

/**
 * Últimos ajustes conocidos, sin React. Lo usa el carrito, que vive en un
 * store de Zustand y no puede llamar a un hook.
 */
export function ajustesEnCache(): AjustesSitio | null {
  return cache;
}

function cargar(): Promise<AjustesSitio> {
  if (cache) return Promise.resolve(cache);
  if (!enVuelo) {
    enVuelo = traerAjustes().then((a) => {
      cache = a;
      enVuelo = null;
      return a;
    });
  }
  return enVuelo;
}

/**
 * Devuelve `null` mientras carga. Los componentes deben usar sus valores por
 * defecto en ese rato para no parpadear ni dejar huecos vacíos.
 */
export function useAjustes(): AjustesSitio | null {
  const [ajustes, setAjustes] = useState<AjustesSitio | null>(cache);

  useEffect(() => {
    if (cache) return;
    let vivo = true;
    void cargar().then((a) => {
      if (vivo) setAjustes(a);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return ajustes;
}
