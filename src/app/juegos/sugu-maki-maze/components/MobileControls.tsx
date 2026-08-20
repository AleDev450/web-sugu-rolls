'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dir } from '../game/types';

/**
 * Controles táctiles: una cruceta bajo la cabina y, como apoyo, el
 * deslizamiento sobre el tablero.
 *
 * La cruceta manda. Jugar solo a swipe obligaba a acertar el gesto justo antes
 * de cada cruce y con dos manos en la pantalla el navegador se ponía a hacer
 * zoom; con un mando fijo el pulgar se queda quieto en un sitio conocido y el
 * tablero deja de recibir dedos.
 */

/* --- cruceta ------------------------------------------------------------ */

/**
 * Medidas del dibujo, sacadas del PNG fuente
 * `/public/games/sugu-maki-maze/jostick.png` (1254x1254) y no a ojo: la cruz no
 * llena el lienzo y los cuatro botones no caen en tercios redondos.
 *
 * Lo que se mide es la CARA de cada botón —el cuadrado oscuro de rim a rim,
 * recorriendo la luminancia por los ejes—, no la silueta con alfa: esa incluye
 * el halo naranja del dibujo y estira las zonas casi un 6 % hacia fuera, con lo
 * que la luz del brazo pulsado se salía del botón.
 *
 *   arriba    x 467..785   y 146..453
 *   abajo     x 467..785   y 826..1110
 *   izquierda x 138..458   y 463..788
 *   derecha   x 796..1114  y 463..787
 */
const HOJA = 1254;
const pc = (px: number) => `${((px / HOJA) * 100).toFixed(2)}%`;

/** Cara de cada botón dentro del lienzo, en % del lado de la cruceta. */
const BRAZOS: {
  dir: Exclude<Dir, 'none'>;
  etiqueta: string;
  caja: { left: string; top: string; width: string; height: string };
}[] = (
  [
    ['up', 'Arriba', 467, 146, 785, 453],
    ['down', 'Abajo', 467, 826, 785, 1110],
    ['left', 'Izquierda', 138, 463, 458, 788],
    ['right', 'Derecha', 796, 463, 1114, 787],
  ] as const
).map(([dir, etiqueta, x0, y0, x1, y1]) => ({
  dir,
  etiqueta,
  caja: { left: pc(x0), top: pc(y0), width: pc(x1 - x0), height: pc(y1 - y0) },
}));

/**
 * Centro de la cruz. Es el del aro central del dibujo (x 459..795, y 455..794),
 * no el del lienzo: el PNG no está perfectamente centrado.
 */
const CENTRO = { x: 627 / HOJA, y: 624.5 / HOJA };

/**
 * Sensibilidad. Radio muerto alrededor del centro, en fracción del lado de la
 * cruceta: por debajo de esto el dedo está en el eje y no se pide dirección.
 * Subirlo pide gestos más largos (menos giros por error); bajarlo responde
 * antes pero se dispara con solo rozar el centro.
 */
const ZONA_MUERTA = 0.14;

/**
 * Mando de cuatro direcciones.
 *
 * No son cuatro botones sueltos: en cuanto el dedo baja se captura el puntero y
 * la dirección se resuelve por el ángulo respecto al centro, así que se puede
 * rodar el pulgar de un brazo a otro sin levantarlo —que es como se encadenan
 * los giros— y el borde entre brazos cae en la diagonal, justo donde el dibujo
 * tiene el hueco. Los `<button>` solo están para dar nombre a cada zona y
 * pintar el brazo encendido.
 */
export function Cruceta({
  onDir,
  activo,
}: {
  onDir: (dir: Dir) => void;
  activo: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const puntero = useRef<number | null>(null);
  const ultima = useRef<Dir>('none');
  const [pulsado, setPulsado] = useState<Dir>('none');

  const soltar = useCallback(() => {
    puntero.current = null;
    ultima.current = 'none';
    setPulsado('none');
  }, []);

  useEffect(() => {
    if (!activo) soltar();
  }, [activo, soltar]);

  const resolver = useCallback(
    (x: number, y: number) => {
      const nodo = ref.current;
      if (!nodo) return;

      const r = nodo.getBoundingClientRect();
      const dx = (x - (r.left + r.width * CENTRO.x)) / r.width;
      const dy = (y - (r.top + r.height * CENTRO.y)) / r.height;

      let dir: Dir = 'none';
      if (Math.hypot(dx, dy) >= ZONA_MUERTA) {
        // gana el eje con más recorrido: en un laberinto no hay diagonales
        if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
        else dir = dy > 0 ? 'down' : 'up';
      }

      if (dir === ultima.current) return;
      ultima.current = dir;
      setPulsado(dir);
      if (dir !== 'none') onDir(dir);
    },
    [onDir]
  );

  const alBajar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activo) return;
    // sin esto el navegador se guarda el gesto para lupa o menú contextual
    e.preventDefault();
    puntero.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    resolver(e.clientX, e.clientY);
  };

  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activo || e.pointerId !== puntero.current) return;
    resolver(e.clientX, e.clientY);
  };

  const alLevantar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== puntero.current) return;
    soltar();
  };

  return (
    <div
      ref={ref}
      className={`maze-cruceta${activo ? '' : ' apagada'}`}
      role="group"
      aria-label="Mando de dirección"
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alLevantar}
      onPointerCancel={alLevantar}
      onContextMenu={(e) => e.preventDefault()}
    >
      {BRAZOS.map(({ dir, etiqueta, caja }) => (
        <button
          key={dir}
          type="button"
          tabIndex={-1}
          aria-label={etiqueta}
          className={`maze-cruceta-brazo${pulsado === dir ? ' pulsado' : ''}`}
          style={caja}
          onClick={() => activo && onDir(dir)}
        />
      ))}
    </div>
  );
}

/* --- deslizamiento sobre el tablero ------------------------------------- */

/**
 * Píxeles que hay que recorrer para que un arrastre cuente como dirección. Con
 * la cruceta el swipe pasó a ser el control de repuesto, así que el umbral se
 * mantiene alto a propósito: así un dedo apoyado en el tablero mientras la otra
 * mano juega no se convierte en un giro.
 */
const UMBRAL = 22;

/**
 * El gesto es CONTINUO: no hace falta levantar el dedo entre giro y giro. En
 * cuanto el dedo se aleja `UMBRAL` píxeles del último punto de referencia se
 * emite una dirección y ese punto se reinicia ahí mismo, así que se puede
 * dibujar el recorrido con un solo trazo.
 */
export function useSwipe(
  ref: React.RefObject<HTMLElement | null>,
  onDir: (dir: Dir) => void,
  activo: boolean
) {
  const origen = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || !activo) return;

    const inicio = (e: TouchEvent) => {
      if (origen.current) return;
      const t = e.changedTouches[0];
      origen.current = { id: t.identifier, x: t.clientX, y: t.clientY };
    };

    const mover = (e: TouchEvent) => {
      const o = origen.current;
      if (!o) return;

      /*
       * Hay que buscar el dedo por su identificador y no coger `touches[0]`:
       * esa lista trae TODOS los dedos de la pantalla, así que con una mano en
       * la cruceta y otra en el tablero el primero podía ser el de la cruceta y
       * el swipe leía un recorrido que nadie hizo.
       */
      let t: Touch | null = null;
      for (const c of Array.from(e.changedTouches)) {
        if (c.identifier === o.id) t = c;
      }
      if (!t) return;

      const dx = t.clientX - o.x;
      const dy = t.clientY - o.y;
      if (Math.abs(dx) < UMBRAL && Math.abs(dy) < UMBRAL) return;

      if (Math.abs(dx) > Math.abs(dy)) onDir(dx > 0 ? 'right' : 'left');
      else onDir(dy > 0 ? 'down' : 'up');

      origen.current = { id: o.id, x: t.clientX, y: t.clientY };
      // evita que el navegador interprete el gesto como scroll o "pull to refresh"
      e.preventDefault();
    };

    const fin = (e: TouchEvent) => {
      const o = origen.current;
      if (!o) return;
      for (const c of Array.from(e.changedTouches)) {
        if (c.identifier === o.id) origen.current = null;
      }
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

/* --- zoom ---------------------------------------------------------------- */

/**
 * Corta el zoom mientras se juega.
 *
 * `maximum-scale=1` en el viewport no basta: iOS lo ignora desde hace años y en
 * Android el pellizco sigue vivo si el gesto empieza fuera del canvas. Se ataca
 * por dos lados: `touch-action: none` en el CSS (que además mata el doble toque)
 * y aquí los gestos que solo existen en Safari más cualquier segundo dedo.
 */
export function useSinZoom() {
  useEffect(() => {
    const frenar = (e: Event) => e.preventDefault();
    const multitactil = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    // gesture*: propietarios de Safari y sin tipar en lib.dom, de ahí la lista
    const gestos = ['gesturestart', 'gesturechange', 'gestureend'];
    for (const g of gestos) document.addEventListener(g, frenar);
    document.addEventListener('touchstart', multitactil, { passive: false });
    document.addEventListener('touchmove', multitactil, { passive: false });

    return () => {
      for (const g of gestos) document.removeEventListener(g, frenar);
      document.removeEventListener('touchstart', multitactil);
      document.removeEventListener('touchmove', multitactil);
    };
  }, []);
}

/* --- pista --------------------------------------------------------------- */

/** Aviso breve la primera vez que se juega en una pantalla táctil. */
export function PistaTactil({ visible }: { visible: boolean }) {
  const [tactil, setTactil] = useState(false);

  useEffect(() => {
    setTactil(window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }, []);

  if (!tactil || !visible) return null;
  return <p className="maze-pista-tactil">Mueve el maki con la cruceta</p>;
}
