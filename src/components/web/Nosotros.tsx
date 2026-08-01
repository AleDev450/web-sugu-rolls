'use client';

import Image from 'next/image';
import { Aparecer } from './Seccion';

const ESTADISTICAS = [
  { valor: '+20', texto: 'variedades' },
  { valor: '100%', texto: 'ingredientes seleccionados' },
  { valor: 'Al momento', texto: 'preparación' },
  { valor: 'Lima', texto: 'delivery' },
];

export function Nosotros() {
  return (
    <section id="nosotros" className="wrap section scroll-mt-24">
      <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
        <Aparecer>
          <p className="kicker">Nosotros</p>
          <h2 className="title-xl mt-5">
            Pasión en cada{' '}
            <span className="font-brush text-[1.28em] font-bold leading-[0.7] text-sugu">
              roll
            </span>
          </h2>

          <p className="mt-7 max-w-prose text-[17px] leading-[1.75] text-bone-dim">
            En Sugu Rolls preparamos cada pedido al momento, combinando ingredientes frescos,
            recetas propias y mucha pasión. Buscamos que cada roll tenga sabor, personalidad y
            una presentación que sorprenda.
          </p>

          <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10">
            {ESTADISTICAS.map((e) => (
              <div key={e.texto}>
                <dt className="text-4xl font-extrabold tracking-tight text-sugu">{e.valor}</dt>
                <dd className="mt-2 text-[14px] leading-snug text-bone-dim">{e.texto}</dd>
              </div>
            ))}
          </dl>
        </Aparecer>

        <Aparecer delay={0.1}>
          <div className="relative aspect-[5/4] overflow-hidden rounded-3xl border border-white/10">
            <Image
              src="/imagenes/web/nosotros.webp"
              alt="Preparación de makis en Sugu Rolls"
              fill
              sizes="(max-width: 1024px) 92vw, 560px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-night/70 via-transparent to-transparent" />
          </div>
        </Aparecer>
      </div>
    </section>
  );
}
