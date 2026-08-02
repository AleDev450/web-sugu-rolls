'use client';

import Image from 'next/image';
import { Check } from 'lucide-react';
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

export function Catering() {
  const s = useSeccion('catering');
  const beneficios = lista<string>(s.extra, 'beneficios', BENEFICIOS_POR_DEFECTO);

  return (
    <section
      id="catering"
      className="relative scroll-mt-24 border-y border-white/5 bg-night-soft section"
    >
      <div className="wrap grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
        <Aparecer>
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 sm:aspect-[5/4] lg:aspect-[4/5]">
            <Image
              src={s.imagen || '/imagenes/web/catering.webp'}
              alt="Bandejas de makis Sugu Rolls preparadas para un evento"
              fill
              sizes="(max-width: 1024px) 92vw, 560px"
              className="object-cover"
            />
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
