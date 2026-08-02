'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Leaf, Sparkles, Truck } from 'lucide-react';
import { lista, texto } from '@/data/secciones';
import { useCartStore } from '@/store/useCartStore';
import { useSeccion } from './useSeccion';

/** Un icono por posición; si se añaden beneficios, se reutilizan en ciclo. */
const ICONOS = [Leaf, Sparkles, Truck];

const surgir = {
  oculto: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.09, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export function Hero() {
  const abrirCarrito = useCartStore((s) => s.abrir);
  const s = useSeccion('hero');

  const beneficios = lista<string>(s.extra, 'beneficios', [
    'Ingredientes frescos',
    'Calidad premium',
    'Delivery rápido',
  ]);

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-48 lg:pt-40">
      {/* halo rojo detrás de la foto */}
      <div
        className="pointer-events-none absolute right-0 top-1/2 h-[900px] w-[900px] -translate-y-1/2 translate-x-1/4 rounded-full opacity-45 blur-[140px]"
        style={{ background: 'radial-gradient(circle, #920B15 0%, transparent 65%)' }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 pattern-asanoha opacity-60" aria-hidden />

      <div className="wrap relative grid items-center gap-16 py-20 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:py-0">
        <div className="order-2 lg:order-1">
          <motion.p
            custom={0}
            initial="oculto"
            animate="visible"
            variants={surgir}
            className="kicker"
          >
            {s.etiqueta}
          </motion.p>

          <motion.h1
            custom={1}
            initial="oculto"
            animate="visible"
            variants={surgir}
            className="mt-7 text-[clamp(3.1rem,7.6vw,6.4rem)] font-extrabold leading-[0.92] tracking-[-0.045em] text-balance"
          >
            {s.titulo}
            <br />
            <span className="font-brush text-[1.32em] font-bold leading-[0.78] text-sugu">
              {s.manuscrito}
            </span>
          </motion.h1>

          <motion.p
            custom={2}
            initial="oculto"
            animate="visible"
            variants={surgir}
            className="mt-9 max-w-prose text-[17px] leading-[1.75] text-bone-dim"
          >
            {s.bajada}
          </motion.p>

          <motion.div
            custom={3}
            initial="oculto"
            animate="visible"
            variants={surgir}
            className="mt-12 flex flex-wrap gap-4"
          >
            <button onClick={abrirCarrito} className="btn-primary">
              {texto(s.extra, 'boton_principal', 'Pedir ahora')}
            </button>
            <Link href="/carta" className="btn-ghost">
              {texto(s.extra, 'boton_secundario', 'Ver nuestra carta')}
            </Link>
          </motion.div>

          <motion.ul
            custom={4}
            initial="oculto"
            animate="visible"
            variants={surgir}
            className="mt-16 flex flex-wrap gap-x-7 gap-y-6"
          >
            {beneficios.map((b, i) => {
              const Icono = ICONOS[i % ICONOS.length];
              return (
                <li key={b} className="flex items-center gap-3">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-sugu/30 bg-sugu/10">
                    <Icono className="h-4.5 w-4.5 text-sugu" />
                  </span>
                  <span className="whitespace-nowrap text-[14px] font-medium text-bone-dim">
                    {b}
                  </span>
                </li>
              );
            })}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative order-1 lg:order-2"
        >
          <div className="relative mx-auto aspect-square w-full max-w-[680px] animate-float">
            <Image
              src={s.imagen || '/imagenes/web/hero-makis.webp'}
              alt="Tabla de makis Sugu Rolls recién preparados"
              fill
              priority
              sizes="(max-width: 1024px) 92vw, 680px"
              className="fade-to-night object-cover"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
