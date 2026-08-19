'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dir } from '../game/types';

/**
 * Controles táctiles.
 *
 * Se eligió el deslizamiento y no un pad en pantalla porque el tablero ocupa
 * casi todo el alto en un móvil: cualquier cruceta taparía justo la parte del
 * laberinto donde está la acción.
 *
 * El gesto es CONTINUO: no hace falta levantar el dedo entre giro y giro. En
 * cuanto el dedo se aleja `UMBRAL` píxeles del último punto de referencia se
 * emite una dirección y ese punto se reinicia ahí mismo, así que se puede
 * dibujar el recorrido con un solo trazo, que es como se juega de verdad.
 */

const UMBRAL = 22;

export function useSwipe(
  ref: React.RefObject<HTMLElement | null>,
  onDir: (dir: Dir) => void,
  activo: boolean
) {
  const origen = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || !activo) return;

    const inicio = (e: TouchEvent) => {
      const t = e.touches[0];
      origen.current = { x: t.clientX, y: t.clientY };
    };

    const mover = (e: TouchEvent) => {
      const o = origen.current;
      if (!o) return;
      const t = e.touches[0];
      const dx = t.clientX - o.x;
      const dy = t.clientY - o.y;

      if (Math.abs(dx) < UMBRAL && Math.abs(dy) < UMBRAL) return;

      // gana el eje con más recorrido: nada de diagonales en un laberinto
      if (Math.abs(dx) > Math.abs(dy)) onDir(dx > 0 ? 'right' : 'left');
      else onDir(dy > 0 ? 'down' : 'up');

      origen.current = { x: t.clientX, y: t.clientY };
      // evita que el navegador interprete el gesto como scroll o "pull to refresh"
      e.preventDefault();
    };

    const fin = () => {
      origen.current = null;
    };

    nodo.addEventListener('touchstart', inicio, { passive: true });
    nodo.addEventListener('touchmove', mover, { passive: false });
    nodo.addEventListener('touchend', fin);
    nodo.addEventListener('touchcancel', fin);

    return () => {
      nodo.removeEventListener('touchstart', inicio);
      nodo.removeEventListener('touchmove', mover);
      nodo.removeEventListener('touchend', fin);
      nodo.removeEventListener('touchcancel', fin);
    };
  }, [ref, onDir, activo]);
}

/** Aviso breve la primera vez que se juega en una pantalla táctil. */
export function PistaTactil({ visible }: { visible: boolean }) {
  const [tactil, setTactil] = useState(false);

  useEffect(() => {
    setTactil(window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }, []);

  if (!tactil || !visible) return null;
  return <p className="maze-pista-tactil">Desliza el dedo para moverte</p>;
}
