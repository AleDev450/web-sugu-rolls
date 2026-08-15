'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { lista, texto } from '@/data/secciones';
import { SITE, whatsappUrl } from '@/data/site';
import { Aparecer } from './Seccion';
import { useSeccion } from './useSeccion';

const BENEFICIOS_POR_DEFECTO = [
  'Bandejas personalizadas',
  'Opciones clásicas, premium y vegetarianas',
  'Entrega programada',
  'Presentación especial',
  'Atención para grupos grandes',
];

const CADA_MS = 5000;
/** distancia mínima de arrastre para contar como swipe, no como un toque */
const UMBRAL_SWIPE = 40;

export function Catering() {
  const s = useSeccion('catering');
  const beneficios = lista<string>(s.extra, 'beneficios', BENEFICIOS_POR_DEFECTO);
  const galeria = lista<string>(s.extra, 'galeria', [s.imagen || '/imagenes/web/catering.webp']);
  const [actual, setActual] = useState(0);
  const tocandoDesde = useRef<number | null>(null);

  // avance automático; se detiene con una sola foto
  useEffect(() => {
    if (galeria.length < 2) return;
    const t = setInterval(() => setActual((i) => (i + 1) % galeria.length), CADA_MS);
    return () => clearInterval(t);
  }, [galeria.length]);

  // si el panel quita fotos y el índice actual se queda fuera de rango
  useEffect(() => {
    if (actual >= galeria.length) setActual(0);
  }, [actual, galeria.length]);

  const ir = (n: number) => setActual((n + galeria.length) % galeria.length);

  /* swipe táctil, para que el carrusel también se pueda mover a mano en el celular */
  const alTocarInicio = (e: React.TouchEvent) => {
    tocandoDesde.current = e.touches[0].clientX;
  };
  const alTocarFin = (e: React.TouchEvent) => {
    if (tocandoDesde.current == null || galeria.length < 2) return;
    const delta = e.changedTouches[0].clientX - tocandoDesde.current;
    tocandoDesde.current = null;
    if (delta > UMBRAL_SWIPE) ir(actual - 1);
    else if (delta < -UMBRAL_SWIPE) ir(actual + 1);
  };

  return (
    <section
      id="catering"
      className="relative scroll-mt-24 border-y border-white/5 bg-night-soft section"
    >
      <div className="wrap grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
        <Aparecer>
          <div
            className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 sm:aspect-[5/4] lg:aspect-[4/5]"
            onTouchStart={alTocarInicio}
            onTouchEnd={alTocarFin}
          >
            <AnimatePresence mode="sync">
              <motion.div
                key={galeria[actual]}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                <Image
                  src={galeria[actual]}
                  alt="Bandejas de makis Sugu Rolls preparadas para un evento"
                  fill
                  priority={actual === 0}
                  sizes="(max-width: 1024px) 92vw, 560px"
                  className="object-cover"
                />
              </motion.div>
            </AnimatePresence>

            {galeria.length > 1 && (
              <>
                <button
                  onClick={() => ir(actual - 1)}
                  className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-night/40 p-2.5 text-white backdrop-blur transition-colors hover:border-white/60"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => ir(actual + 1)}
                  className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-night/40 p-2.5 text-white backdrop-blur transition-colors hover:border-white/60"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <div className="absolute inset-x-0 bottom-24 z-10 flex justify-center gap-2">
                  {galeria.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      onClick={() => setActual(i)}
                      aria-label={`Ir a la foto ${i + 1}`}
                      aria-current={i === actual}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        i === actual ? 'w-6 bg-sugu' : 'w-2.5 bg-white/40 hover:bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-night/80 via-transparent to-transparent" />

            <div className="absolute bottom-6 left-6 rounded-2xl border border-white/10 bg-night/80 px-5 py-4 backdrop-blur-md">
              <p className="text-2xl font-extrabold text-sugu">
                {texto(s.extra, 'dato_valor', '+150')}
              </p>
              <p className="text-[11px] text-bone-dim">
                {texto(s.extra, 'dato_texto', 'eventos atendidos')}
              </p>
            </div>
          </div>
        </Aparecer>

        <Aparecer delay={0.1}>
          <p className="kicker">{s.etiqueta}</p>
          <h2 className="title-xl mt-5">
            {s.titulo}{' '}
            <span className="font-brush text-[1.28em] font-bold leading-[0.7] text-sugu">
              {s.manuscrito}
            </span>
          </h2>

          <p className="mt-7 max-w-prose text-[17px] leading-[1.75] text-bone-dim">{s.bajada}</p>

          <ul className="mt-11 space-y-5">
            {beneficios.map((b) => (
              <li key={b} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-sugu/15">
                  <Check className="h-3.5 w-3.5 text-sugu" />
                </span>
                <span className="text-[15px] text-bone-dim">{b}</span>
              </li>
            ))}
          </ul>

          <a
            href={whatsappUrl(
              `¡Hola ${SITE.nombre}! Quisiera una cotización de catering para un evento.`
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-12"
          >
            {texto(s.extra, 'boton', 'Solicitar cotización')}
          </a>
        </Aparecer>
      </div>
    </section>
  );
}
