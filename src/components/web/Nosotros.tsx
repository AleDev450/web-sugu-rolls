'use client';

import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { lista } from '@/data/secciones';
import { Aparecer } from './Seccion';
import { useSeccion } from './useSeccion';

/**
 * El párrafo de Nosotros se escribe en Markdown desde el panel —igual que
 * Términos y condiciones—, así que se pinta con `react-markdown` en vez de un
 * `<p>` plano: sin esto, un admin que escriba "## Nuestra historia" vería el
 * `##` tal cual en la web.
 */
const ESTILOS_BAJADA = [
  'max-w-prose text-[17px] leading-[1.75] text-bone-dim',
  '[&_p]:mt-5 first:[&_p]:mt-0',
  '[&_strong]:font-semibold [&_strong]:text-bone',
  '[&_ul]:mt-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5',
  '[&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5',
  '[&_a]:text-sugu [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-sugu-glow',
].join(' ');

interface Estadistica {
  valor: string;
  texto: string;
}

const POR_DEFECTO: Estadistica[] = [
  { valor: '+20', texto: 'variedades' },
  { valor: '100%', texto: 'ingredientes seleccionados' },
  { valor: 'Al momento', texto: 'preparación' },
  { valor: 'Lima', texto: 'delivery' },
];

export function Nosotros() {
  const s = useSeccion('nosotros');
  const estadisticas = lista<Estadistica>(s.extra, 'estadisticas', POR_DEFECTO);

  return (
    <section id="nosotros" className="wrap section scroll-mt-24">
      <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
        <Aparecer>
          <p className="kicker">{s.etiqueta}</p>
          <h2 className="title-xl mt-5">
            {s.titulo}{' '}
            <span className="font-brush text-[1.28em] font-bold leading-[0.7] text-sugu">
              {s.manuscrito}
            </span>
          </h2>

          {s.bajada && (
            <div className={`mt-7 ${ESTILOS_BAJADA}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.bajada}</ReactMarkdown>
            </div>
          )}

          <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10">
            {estadisticas.map((e) => (
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
              src={s.imagen || '/imagenes/web/nosotros.webp'}
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
