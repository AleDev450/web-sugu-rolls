'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Gamepad2, HelpCircle } from 'lucide-react';
import { SITE } from '@/data/site';
import { Aparecer } from './Seccion';

const PASOS = [
  { n: '01', texto: 'Ingresa al juego.' },
  { n: '02', texto: 'Alcanza el puntaje requerido.' },
  { n: '03', texto: 'Obtén tu premio o cupón.' },
];

/** Personajes que rodean el dispositivo. */
const MASCOTAS = [
  { src: '/imagenes/bt21/cooky.webp', clase: '-left-10 top-6 h-24 w-24 sm:h-32 sm:w-32', delay: 0 },
  { src: '/imagenes/bt21/chimmy.webp', clase: '-right-8 top-24 h-20 w-20 sm:h-26 sm:w-26', delay: 0.5 },
  { src: '/imagenes/bt21/tata.webp', clase: '-left-6 bottom-24 h-20 w-20 sm:h-26 sm:w-26', delay: 1 },
  { src: '/imagenes/bt21/van.webp', clase: '-right-10 bottom-8 h-24 w-24 sm:h-32 sm:w-32', delay: 1.5 },
];

export function Juego() {
  return (
    <section
      id="juego"
      className="relative scroll-mt-24 overflow-hidden section"
      style={{ backgroundImage: 'linear-gradient(155deg, #E31323 0%, #920B15 100%)' }}
    >
      {/* trazos negros japoneses de fondo */}
      <svg
        className="pointer-events-none absolute -left-20 -top-24 h-[420px] w-[420px] opacity-[0.13]"
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
      >
        <circle cx="50" cy="50" r="42" stroke="#000" strokeWidth="3" strokeDasharray="6 10" />
        <circle cx="50" cy="50" r="30" stroke="#000" strokeWidth="6" />
        <circle cx="50" cy="50" r="16" stroke="#000" strokeWidth="2" />
      </svg>
      <svg
        className="pointer-events-none absolute -bottom-32 -right-24 h-[520px] w-[520px] opacity-[0.1]"
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
      >
        <path
          d="M5 60 Q 30 25, 55 55 T 95 45"
          stroke="#000"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M5 78 Q 35 50, 60 74 T 95 66"
          stroke="#000"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>

      <div className="wrap relative grid items-center gap-20 lg:grid-cols-2 lg:gap-16">
        <Aparecer>
          <span className="inline-flex items-center gap-2.5 rounded-full bg-black/25 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest">
            <Gamepad2 className="h-4 w-4" />
            Sugu Game
          </span>

          <h2 className="title-xl mt-7 text-balance">
            Juega y gana con
            <br />
            <span className="font-brush text-[1.28em] font-bold leading-[0.75]">Sugu Rolls</span>
          </h2>

          <p className="mt-7 max-w-prose text-[17px] leading-[1.75] text-white/85">
            Combina ingredientes, completa pedidos y desbloquea premios exclusivos. Consigue
            descuentos, productos gratis y muchas sorpresas.
          </p>

          <div className="mt-11 flex flex-wrap gap-4">
            <Link
              href={SITE.juegoUrl}
              className="inline-flex items-center gap-2.5 rounded-full bg-night px-9 py-4 text-[15px] font-bold text-white transition-all duration-500 ease-premium hover:-translate-y-1 hover:shadow-[0_22px_54px_-14px_rgba(0,0,0,0.9)]"
            >
              <Gamepad2 className="h-4.5 w-4.5" />
              Jugar ahora
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2.5 rounded-full border border-white/35 px-9 py-4 text-[15px] font-semibold text-white transition-all duration-500 ease-premium hover:-translate-y-1 hover:bg-white/10"
            >
              <HelpCircle className="h-4.5 w-4.5" />
              ¿Cómo funciona?
            </a>
          </div>

          <ol id="como-funciona" className="mt-16 scroll-mt-28 space-y-6">
            {PASOS.map((paso) => (
              <li key={paso.n} className="flex items-center gap-5">
                <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full border-2 border-black/25 bg-black/20 text-base font-extrabold">
                  {paso.n}
                </span>
                <span className="text-[17px] font-medium">{paso.texto}</span>
              </li>
            ))}
          </ol>
        </Aparecer>

        <Aparecer delay={0.15}>
          <div className="relative mx-auto w-full max-w-[420px]">
            {/* marco del celular con la captura real del juego */}
            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="relative overflow-hidden rounded-[2.6rem] border-[10px] border-night bg-night shadow-[0_40px_90px_-20px_rgba(0,0,0,0.85)]"
            >
              <div className="absolute left-1/2 top-0 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-night" />
              <div className="relative aspect-[9/16] w-full">
                <Image
                  src="/imagenes/ui/vista-principal.webp"
                  alt="Pantalla del juego Sugu Rolls"
                  fill
                  sizes="420px"
                  className="object-cover"
                />
              </div>
            </motion.div>

            {MASCOTAS.map((m) => (
              <motion.div
                key={m.src}
                animate={{ y: [0, -12, 0] }}
                transition={{
                  duration: 4.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: m.delay,
                }}
                className={`absolute ${m.clase} drop-shadow-2xl`}
                aria-hidden
              >
                <Image src={m.src} alt="" fill sizes="96px" className="object-contain" />
              </motion.div>
            ))}
          </div>
        </Aparecer>
      </div>
    </section>
  );
}
