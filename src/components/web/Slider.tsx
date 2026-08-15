'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { traerSlides, type Slide } from '@/lib/contenido';
import { useAjustes } from '@/lib/useAjustes';

const CADA_MS = 6000;
/** distancia mínima de arrastre para contar como swipe, no como un toque */
const UMBRAL_SWIPE = 40;

/**
 * Carrusel de portada a pantalla completa.
 *
 * Cada diapositiva trae DOS imágenes: la de escritorio (1920×1080) y una
 * vertical para teléfono. Una foto apaisada recortada a pantalla de móvil
 * pierde el centro y suele dejar fuera lo importante, así que se sirven por
 * separado con `<picture>` y el navegador elige — no hay salto ni descarga
 * doble.
 */
export function Slider() {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [actual, setActual] = useState(0);
  const ajustes = useAjustes();
  const tocandoDesde = useRef<number | null>(null);

  useEffect(() => {
    void traerSlides().then(setSlides);
  }, []);

  const total = slides?.length ?? 0;

  // avance automático; se detiene con una sola diapositiva
  useEffect(() => {
    if (total < 2) return;
    const t = setInterval(() => setActual((i) => (i + 1) % total), CADA_MS);
    return () => clearInterval(t);
  }, [total]);

  if (slides === null) {
    return <div className="h-[calc(100svh-var(--header-alto))] w-full bg-night" aria-hidden />;
  }

  // sin diapositivas cargadas, la portada sigue con el hero de siempre
  if (total === 0) return null;

  const ir = (n: number) => setActual((n + total) % total);
  const s = slides[actual];

  /*
   * Swipe táctil: en móvil las flechas se esconden (`hidden sm:block`) y sin
   * esto el único control manual eran los puntos, chiquitos y poco obvios.
   * El gesto es el que espera cualquiera que use un carrusel en el celular.
   */
  const alTocarInicio = (e: React.TouchEvent) => {
    tocandoDesde.current = e.touches[0].clientX;
  };
  const alTocarFin = (e: React.TouchEvent) => {
    if (tocandoDesde.current == null || total < 2) return;
    const delta = e.changedTouches[0].clientX - tocandoDesde.current;
    tocandoDesde.current = null;
    if (delta > UMBRAL_SWIPE) ir(actual - 1);
    else if (delta < -UMBRAL_SWIPE) ir(actual + 1);
  };

  const hayTexto = Boolean(s.titulo || s.subtitulo || s.boton_texto);
  // el panel lo guarda de 0 a 100; aquí hace falta de 0 a 1
  const velo = Math.min(100, Math.max(0, s.velo ?? 35)) / 100;

  /*
   * ALTURA POR PROPORCIÓN, no por pantalla.
   *
   * Antes ocupaba `100svh - header`, y ese hueco es más apaisado que 16:9 en
   * cualquier monitor: la foto se recortaba arriba y abajo, justo donde el
   * diseño pone el titular. Usando la proporción de la propia imagen —16:9 en
   * escritorio, 9:16 en móvil— se ve ENTERA, sin recortar nada.
   *
   * Arranca donde termina el header: `--header-alto` lo publica el propio
   * Header midiéndose, más el margen opcional del panel.
   */
  const conMovil = Boolean(s.imagen_movil);
  const separacion = `calc(var(--header-alto) + ${ajustes?.slider_margen ?? 0}px)`;

  // ¿toda la diapositiva se puede pisar, no solo el botón?
  const Envoltura: React.ElementType = s.boton_enlace ? Link : 'div';
  const propsEnvoltura = s.boton_enlace
    ? { href: s.boton_enlace, 'aria-label': s.titulo || s.boton_texto || 'Ver más' }
    : {};

  return (
    <section
      className={`relative w-full overflow-hidden bg-night ${
        conMovil ? 'aspect-[9/16] md:aspect-[16/9]' : 'aspect-[16/9]'
      }`}
      style={{ marginTop: separacion }}
      onTouchStart={alTocarInicio}
      onTouchEnd={alTocarFin}
    >
      {/*
        Si la diapositiva tiene ruta, TODA la foto es el link, no solo el
        botón chiquito: antes el botón solo aparecía con texto propio y era
        lo único clickeable, así que un slide con enlace pero sin texto de
        botón (o un click fuera del botón) no llevaba a ningún lado.
      */}
      <Envoltura {...propsEnvoltura} className="absolute inset-0 z-0 block">
      <AnimatePresence mode="sync">
        <motion.div
          key={s.id}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          {/*
            Dos imágenes con su propio encuadre. `next/image` no permite
            cambiar el `src` por consulta de medios, así que se usan dos
            capas y CSS decide cuál se ve: el navegador solo descarga la
            visible porque la otra queda con `display: none`.
          */}
          {s.imagen_movil && (
            <Image
              src={s.imagen_movil}
              alt={s.titulo || 'Sugu Rolls'}
              fill
              priority={actual === 0}
              sizes="100vw"
              className="object-cover md:hidden"
              style={{ objectPosition: s.foco_movil || '50% 50%' }}
            />
          )}
          <Image
            src={s.imagen || s.imagen_movil}
            alt={s.titulo || 'Sugu Rolls'}
            fill
            priority={actual === 0}
            sizes="100vw"
            className={`object-cover ${s.imagen_movil ? 'hidden md:block' : ''}`}
            style={{
              objectPosition: (s.imagen_movil ? s.foco : s.foco_movil) || '50% 50%',
            }}
          />

          {/*
            Velo SOLO abajo y solo si hay texto que proteger. Antes cubría la
            foto entera con un degradado fijo y la dejaba apagada; ahora la
            intensidad la decide cada diapositiva desde el panel, y una
            diapositiva sin texto se ve tal cual se subió.
          */}
          {hayTexto && (
            <div
              className="absolute inset-x-0 bottom-0 h-2/3"
              style={{
                // el velo del panel marca el negro de abajo; arriba se disuelve
                backgroundImage: `linear-gradient(to top, rgba(5,5,5,${velo}), rgba(5,5,5,${velo * 0.45}) 45%, transparent)`,
              }}
              aria-hidden
            />
          )}
        </motion.div>
      </AnimatePresence>

      {(s.titulo || s.subtitulo || s.boton_texto) && (
        <div className="wrap relative flex h-full flex-col items-start justify-end pb-24 sm:pb-32">
          <motion.div
            key={`texto-${s.id}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl"
          >
            {s.titulo && <h1 className="title-xl text-balance">{s.titulo}</h1>}
            {s.subtitulo && (
              <p className="mt-5 max-w-prose text-[17px] leading-relaxed text-bone-dim">
                {s.subtitulo}
              </p>
            )}
            {/* ya no es un <Link> propio: toda la diapositiva es el enlace */}
            {s.boton_texto && s.boton_enlace && (
              <span className="btn-primary mt-8">{s.boton_texto}</span>
            )}
          </motion.div>
        </div>
      )}
      </Envoltura>

      {total > 1 && (
        <>
          <button
            onClick={() => ir(actual - 1)}
            className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/20 bg-night/40 p-3 text-white backdrop-blur transition-colors hover:border-white/60 sm:block"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => ir(actual + 1)}
            className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/20 bg-night/40 p-3 text-white backdrop-blur transition-colors hover:border-white/60 sm:block"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center gap-2.5">
            {slides.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setActual(i)}
                aria-label={`Ir a la diapositiva ${i + 1}`}
                aria-current={i === actual}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === actual ? 'w-8 bg-sugu' : 'w-4 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
