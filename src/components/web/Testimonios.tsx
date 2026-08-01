'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import { TESTIMONIOS } from '@/data/productos';
import { TituloSeccion } from './Seccion';

export function Testimonios() {
  const [indice, setIndice] = useState(0);
  const [direccion, setDireccion] = useState(1);

  const mover = (paso: number) => {
    setDireccion(paso);
    setIndice((i) => (i + paso + TESTIMONIOS.length) % TESTIMONIOS.length);
  };

  const actual = TESTIMONIOS[indice];

  return (
    <section className="relative border-y border-white/5 bg-night-soft section">
      <div className="pointer-events-none absolute inset-0 pattern-asanoha opacity-50" aria-hidden />

      <div className="wrap relative">
        <TituloSeccion etiqueta="Testimonios" titulo="Lo que dicen" manuscrito="de nosotros" />

        <div className="relative mx-auto mt-20 max-w-3xl">
          <div className="min-h-[260px] sm:min-h-[220px]">
            <AnimatePresence mode="wait" custom={direccion}>
              <motion.blockquote
                key={indice}
                custom={direccion}
                initial={{ opacity: 0, x: direccion * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direccion * -40 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="card relative p-10 sm:p-14"
              >
                <Quote className="absolute right-9 top-9 h-12 w-12 text-sugu/15" aria-hidden />

                <div className="flex gap-1.5" aria-label={`${actual.estrellas} de 5 estrellas`}>
                  {Array.from({ length: actual.estrellas }).map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-sugu text-sugu" />
                  ))}
                </div>

                <p className="mt-7 text-[21px] leading-[1.6] text-bone-soft">
                  “{actual.comentario}”
                </p>

                <footer className="mt-9 flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sugu/15 text-base font-bold text-sugu">
                    {actual.nombre.charAt(0)}
                  </span>
                  <cite className="not-italic">
                    <span className="block text-[15px] font-semibold">{actual.nombre}</span>
                    <span className="block text-[13px] text-bone-dim">Cliente Sugu Rolls</span>
                  </cite>
                </footer>
              </motion.blockquote>
            </AnimatePresence>
          </div>

          <div className="mt-7 flex items-center justify-center gap-4">
            <button
              onClick={() => mover(-1)}
              className="rounded-full border border-white/15 p-2.5 transition-colors hover:border-sugu hover:text-sugu"
              aria-label="Testimonio anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex gap-2">
              {TESTIMONIOS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setDireccion(i > indice ? 1 : -1);
                    setIndice(i);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === indice ? 'w-7 bg-sugu' : 'w-1.5 bg-white/25 hover:bg-white/50'
                  }`}
                  aria-label={`Ir al testimonio ${i + 1}`}
                  aria-current={i === indice}
                />
              ))}
            </div>

            <button
              onClick={() => mover(1)}
              className="rounded-full border border-white/15 p-2.5 transition-colors hover:border-sugu hover:text-sugu"
              aria-label="Testimonio siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
