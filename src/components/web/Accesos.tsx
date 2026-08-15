'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Gamepad2 } from 'lucide-react';
import { lista, texto } from '@/data/secciones';
import { Aparecer } from './Seccion';
import { useSeccion } from './useSeccion';

interface Tarjeta {
  titulo: string;
  texto: string;
  imagen: string;
  href: string;
}

const TARJETAS_POR_DEFECTO: Tarjeta[] = [
  {
    titulo: 'Nuestra Carta',
    texto: 'Descubre todos nuestros makis, bowls, entradas y bebidas.',
    imagen: '/imagenes/web/carta.webp',
    href: '/carta',
  },
  {
    titulo: 'Catering',
    texto: 'Lleva el sabor de Sugu Rolls a reuniones, cumpleaños y ocasiones especiales.',
    imagen: '/imagenes/web/catering.webp',
    href: '/catering',
  },
];

/** Las puertas de entrada de la portada: carta, catering y el juego. */
export function Accesos() {
  const s = useSeccion('accesos');
  const tarjetas = lista<Tarjeta>(s.extra, 'tarjetas', TARJETAS_POR_DEFECTO);

  return (
    <section className="wrap section">
      <div className="grid gap-7 lg:grid-cols-3">
        {tarjetas.map((t, i) => (
          <Aparecer key={t.href} delay={i * 0.08}>
            <TarjetaAcceso {...t} />
          </Aparecer>
        ))}

        <Aparecer delay={tarjetas.length * 0.08}>
          <TarjetaJuego
            titulo={texto(s.extra, 'juego_titulo', 'Sugu Games')}
            descripcion={texto(
              s.extra,
              'juego_texto',
              'Juega, gana y disfruta de descuentos, makis gratis y premios exclusivos.'
            )}
            boton={texto(s.extra, 'juego_boton', 'Jugar ahora')}
          />
        </Aparecer>
      </div>
    </section>
  );
}

function TarjetaAcceso({ href, titulo, texto: descripcion, imagen }: Tarjeta) {
  return (
    <Link
      href={href}
      className="group relative flex h-[520px] flex-col justify-end overflow-hidden rounded-[2rem] border border-white/10 transition-all duration-700 ease-premium hover:border-sugu/40"
    >
      <Image
        src={imagen}
        alt={titulo}
        fill
        sizes="(max-width: 1024px) 100vw, 33vw"
        className="object-cover transition-transform duration-[1.2s] ease-premium group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-night via-night/70 to-night/10" />

      <div className="relative p-10">
        <h3 className="text-3xl font-bold tracking-tight">{titulo}</h3>
        <p className="mt-3.5 max-w-[34ch] text-[15px] leading-relaxed text-bone-dim">
          {descripcion}
        </p>
        <span className="mt-8 inline-flex items-center gap-2.5 text-[15px] font-semibold text-sugu">
          Ver más
          <ArrowRight className="h-4.5 w-4.5 transition-transform duration-500 group-hover:translate-x-2" />
        </span>
      </div>
    </Link>
  );
}

function TarjetaJuego({
  titulo,
  descripcion,
  boton,
}: {
  titulo: string;
  descripcion: string;
  boton: string;
}) {
  return (
    <div
      className="group relative flex h-[520px] flex-col justify-between overflow-hidden rounded-[2rem] p-10"
      style={{ backgroundImage: 'linear-gradient(150deg, #E31323 0%, #920B15 100%)' }}
    >
      <svg
        className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 opacity-15"
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
      >
        <circle cx="50" cy="50" r="38" stroke="#000" strokeWidth="7" strokeDasharray="4 12" />
        <circle cx="50" cy="50" r="24" stroke="#000" strokeWidth="5" />
      </svg>
      <div
        className="pointer-events-none absolute -bottom-16 -left-10 h-52 w-52 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #000 0%, transparent 70%)' }}
        aria-hidden
      />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-black/25 px-4 py-2 text-[11px] font-bold uppercase tracking-widest">
          <Gamepad2 className="h-4 w-4" />
          Sugu Games
        </span>
        <h3 className="mt-7 max-w-[14ch] text-3xl font-bold leading-[1.1] tracking-tight">
          {titulo}
        </h3>
        <p className="mt-4 max-w-[26ch] text-[15px] leading-relaxed text-white/85">
          {descripcion}
        </p>
      </div>

      <div className="relative flex items-end justify-between gap-4">
        <Link
          href="/sugu-games"
          className="inline-flex items-center gap-2.5 rounded-full bg-night px-8 py-4 text-[15px] font-bold text-white transition-transform duration-500 ease-premium hover:-translate-y-1"
        >
          {boton}
          <ArrowRight className="h-4.5 w-4.5" />
        </Link>

        <Image
          src="/imagenes/bt21/cooky.webp"
          alt=""
          width={104}
          height={104}
          aria-hidden
          className="animate-float drop-shadow-2xl transition-transform duration-700 group-hover:scale-110"
        />
      </div>
    </div>
  );
}
