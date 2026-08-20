'use client';

import { useEffect, useState } from 'react';
import type { Dir } from '../game/types';

/**
 * Controles táctiles: un joystick flotante sobre el tablero.
 *
 * Antes hubo dos intentos y los dos fallaban por lo mismo, apuntar. El swipe
 * obligaba a acertar el gesto justo antes de cada cruce; la cruceta dibujada,
 * a acertar un botón que estaba lejos del pulgar y que no se puede mirar
 * mientras te persiguen. Aquí no hay a dónde apuntar: pones el dedo donde
 * quieras del laberinto y el stick nace debajo, así que se juega con una mano y
 * sin despegar la vista del maki.
 *
 * Lo mueve nipplejs, que es la librería de joystick virtual de toda la vida en
 * web (MIT, sin dependencias). Nos interesa su evento `dir`, que ya reparte el
 * círculo en cuatro cuartos de 90° partidos por las diagonales: gana el eje con
 * más recorrido, que es justo lo que pide un laberinto sin diagonales.
 */

/**
 * Sensibilidad: fuerza mínima —0 en el centro, 1 en el borde— para que el
 * stick cante una dirección. Subirlo pide empujar más lejos (menos giros por
 * error al posar el dedo); bajarlo responde antes pero se dispara con temblar.
 */
const UMBRAL = 0.16;

/** Diámetro del círculo exterior, en px. El interior es la mitad. */
const TAMANO = 104;

/**
 * Engancha el joystick a una zona. Se crea al empezar a jugar y se destruye al
 * pausar o morir, que además es lo que lo borra de la pantalla.
 */
export function useJoystick(
  ref: React.RefObject<HTMLElement | null>,
  onDir: (dir: Dir) => void,
  activo: boolean
) {
  useEffect(() => {
    const zona = ref.current;
    if (!zona || !activo) return;

    let vivo = true;
    let gestor: { destroy: () => void } | null = null;

    (async () => {
      /*
       * Import dinámico por lo mismo que PixiJS: el módulo toca el DOM al
       * cargarse y así el bundle no se pide hasta que hay partida en marcha.
       */
      const nipplejs = (await import('nipplejs')).default;
      if (!vivo) return;

      const collection = nipplejs.create({
        zone: zona,
        mode: 'dynamic',
        size: TAMANO,
        threshold: UMBRAL,
        fadeTime: 90,
        restOpacity: 0.55,
        // un laberinto se juega con un dedo: el segundo solo estorba
        multitouch: false,
        maxNumberOfJoysticks: 1,
        color: { front: '#f7ecd8', back: 'rgba(255, 59, 31, 0.14)' },
      });

      collection.on('dir', (evt) => {
        const dir = evt.data.direction?.angle;
        if (dir) onDir(dir);
      });

      gestor = collection;
    })();

    return () => {
      vivo = false;
      gestor?.destroy();
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

/* --- detección de pantalla táctil ---------------------------------------- */

/**
 * Si toca sacar los controles de dedo.
 *
 * Se preguntaba por `(hover: none) and (pointer: coarse)` y en algunos móviles
 * eso no basta: hay navegadores que declaran `hover: hover` —y el modo
 * escritorio lo hace siempre—. Ahora se pregunta solo por `pointer: coarse`,
 * que es lo que importa (el dedo es un puntero gordo), y además se enciende en
 * cuanto llega el primer toque real: no hay teléfono que se escape.
 */
export function useTactil(): boolean {
  const [tactil, setTactil] = useState(false);

  useEffect(() => {
    const grueso = window.matchMedia('(pointer: coarse)');
    if (grueso.matches) setTactil(true);

    const alCambiar = (e: MediaQueryListEvent) => e.matches && setTactil(true);
    const alTocar = (e: PointerEvent) => e.pointerType === 'touch' && setTactil(true);

    grueso.addEventListener('change', alCambiar);
    window.addEventListener('pointerdown', alTocar);
    return () => {
      grueso.removeEventListener('change', alCambiar);
      window.removeEventListener('pointerdown', alTocar);
    };
  }, []);

  return tactil;
}

/* --- pista --------------------------------------------------------------- */

/** Aviso breve la primera vez que se juega en una pantalla táctil. */
export function PistaTactil({ visible }: { visible: boolean }) {
  const tactil = useTactil();
  if (!tactil || !visible) return null;
  return <p className="maze-pista-tactil">Arrastra el dedo por el tablero</p>;
}
