'use client';

import { useEffect, useRef } from 'react';
import { DESIGN } from '@/game/config/layout';

/**
 * Encaja el marco del juego en la pantalla.
 *
 * El juego se compone siempre en el lienzo de diseño (480x854) y se escala
 * completo con `transform: scale(--fit)`. Escalar el marco entero —en vez de
 * estirar cada caja— mantiene alineados el canvas de Pixi, la barra del HUD y
 * los hotspots dibujados sobre las ilustraciones, que están posicionados en
 * porcentajes del diseño.
 *
 * Devuelve la ref que va en el elemento `.phone`; el factor se mide sobre su
 * contenedor (`.juego-root`), no sobre `window`, para que en móvil la barra de
 * direcciones del navegador no descuadre la cuenta.
 */
export function useEscalaJuego() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const marco = ref.current;
    const contenedor = marco?.parentElement;
    if (!marco || !contenedor) return;

    const ajustar = () => {
      const factor = Math.min(
        contenedor.clientWidth / DESIGN.width,
        contenedor.clientHeight / DESIGN.height
      );
      if (factor > 0) marco.style.setProperty('--fit', factor.toFixed(4));
    };

    ajustar();

    const observador = new ResizeObserver(ajustar);
    observador.observe(contenedor);
    // iOS no siempre reporta el cambio de tamaño al girar el dispositivo
    window.addEventListener('orientationchange', ajustar);

    return () => {
      observador.disconnect();
      window.removeEventListener('orientationchange', ajustar);
    };
  }, []);

  return ref;
}
