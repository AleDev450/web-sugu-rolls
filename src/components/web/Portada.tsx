'use client';

import { useEffect, useState } from 'react';
import { traerSlides } from '@/lib/contenido';
import { Hero } from './Hero';
import { Slider } from './Slider';

/**
 * Cabecera de la portada.
 *
 * Con diapositivas cargadas desde el panel manda el carrusel a pantalla
 * completa; sin ninguna, se queda el hero de siempre. Así la web nunca
 * aparece decapitada mientras no se hayan subido las imágenes.
 */
export function Portada() {
  const [haySlides, setHaySlides] = useState<boolean | null>(null);

  useEffect(() => {
    void traerSlides().then((s) => setHaySlides(s.length > 0));
  }, []);

  // mientras se decide no se pinta nada: alternar hero -> slider se vería
  // como un salto brusco justo al abrir la web
  if (haySlides === null) return <div className="h-[100svh] bg-night" aria-hidden />;

  return haySlides ? <Slider /> : <Hero />;
}
