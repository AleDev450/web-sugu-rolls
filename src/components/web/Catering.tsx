'use client';

import Image from 'next/image';
import { Check } from 'lucide-react';
import { SITE, whatsappUrl } from '@/data/site';
import { Aparecer } from './Seccion';

const BENEFICIOS = [
  'Bandejas personalizadas',
  'Opciones clásicas, premium y vegetarianas',
  'Entrega programada',
  'Presentación especial',
  'Atención para grupos grandes',
];

export function Catering() {
  return (
    <section
      id="catering"
      className="relative scroll-mt-24 border-y border-white/5 bg-night-soft section"
    >
      <div className="wrap grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
        <Aparecer>
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 sm:aspect-[5/4] lg:aspect-[4/5]">
            <Image
              src="/imagenes/web/catering.webp"
              alt="Bandejas de makis Sugu Rolls preparadas para un evento"
              fill
              sizes="(max-width: 1024px) 92vw, 560px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-night/80 via-transparent to-transparent" />

            <div className="absolute bottom-6 left-6 rounded-2xl border border-white/10 bg-night/80 px-5 py-4 backdrop-blur-md">
              <p className="text-2xl font-extrabold text-sugu">+150</p>
              <p className="text-[11px] text-bone-dim">eventos atendidos</p>
            </div>
          </div>
        </Aparecer>

        <Aparecer delay={0.1}>
          <p className="kicker">Eventos y empresas</p>
          <h2 className="title-xl mt-5">
            Catering{' '}
            <span className="font-brush text-[1.28em] font-bold leading-[0.7] text-sugu">
              Sugu Rolls
            </span>
          </h2>

          <p className="mt-7 max-w-prose text-[17px] leading-[1.75] text-bone-dim">
            Creamos experiencias gastronómicas para reuniones corporativas, cumpleaños,
            celebraciones y eventos privados.
          </p>

          <ul className="mt-11 space-y-5">
            {BENEFICIOS.map((b) => (
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
            Solicitar cotización
          </a>
        </Aparecer>
      </div>
    </section>
  );
}
