'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { traerSlides, type Slide } from '@/lib/contenido';

const CADA_MS = 6000;

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
    return <div className="h-[100svh] w-full bg-night" aria-hidden />;
  }

  // sin diapositivas cargadas, la portada sigue con el hero de siempre
  if (total === 0) return null;

  const ir = (n: number) => setActual((n + total) % total);
  const s = slides[actual];

  return (
    <section className="relative h-[100svh] w-full overflow-hidden bg-night">
      <AnimatePresence mode="sync">
        <motion.div
          key={s.id}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <picture>
            {s.imagen_movil && (
              <source media="(max-width: 767px)" srcSet={s.imagen_movil} />
            )}
            <Image
              src={s.imagen || s.imagen_movil}
              alt={s.titulo || 'Sugu Rolls'}
              fill
              priority={actual === 0}
              sizes="100vw"
              className="object-cover"
            />
          </picture>
          {/* velo inferior: sin él el texto se pierde sobre fotos claras */}
          <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-night/10" />
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
            {s.boton_texto && s.boton_enlace && (
              <Link href={s.boton_enlace} className="btn-primary mt-8">
                {s.boton_texto}
              </Link>
            )}
          </motion.div>
        </div>
      )}

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
