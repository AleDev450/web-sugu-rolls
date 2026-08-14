'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Producto } from '@/data/productos';
import { texto } from '@/data/secciones';
import { traerFavoritos } from '@/lib/contenido';
import { Aparecer, TituloSeccion } from './Seccion';
import { useSeccion } from './useSeccion';

/**
 * Los rolls más pedidos: escaparate, no tienda.
 *
 * NO llevan precio ni botón de añadir. Aquí el objetivo es dar ganas y
 * mandar a la carta, donde están las presentaciones y el precio real; poner
 * un importe suelto obligaba a elegir uno entre varios y confundía.
 *
 * Arranca en null y no con los datos locales: al sembrarlo con el catálogo
 * del código se veían las fotos ANTIGUAS un instante y luego saltaban a las
 * del panel. Mejor un hueco discreto que enseñar algo que ya no existe.
 */
const CUANTOS = 4;

export function Favoritos() {
  const [favoritos, setFavoritos] = useState<Producto[] | null>(null);
  const s = useSeccion('favoritos');

  useEffect(() => {
    void traerFavoritos().then((f) => setFavoritos(f.slice(0, CUANTOS)));
  }, []);

  return (
    <section id="favoritos" className="relative border-y border-white/5 bg-night-soft section">
      <div className="pointer-events-none absolute inset-0 pattern-asanoha opacity-50" aria-hidden />

      <div className="wrap relative">
        <TituloSeccion
          etiqueta={s.etiqueta}
          titulo={s.titulo}
          manuscrito={s.manuscrito}
          centrado={false}
          accion={
            <Link
              href="/carta"
              className="group inline-flex flex-none items-center gap-2.5 text-[15px] font-semibold text-sugu"
            >
              {texto(s.extra, 'enlace', 'Ver carta completa')}
              <ArrowRight className="h-4.5 w-4.5 transition-transform duration-500 group-hover:translate-x-2" />
            </Link>
          }
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {favoritos === null
            ? Array.from({ length: CUANTOS }).map((_, i) => (
                <div key={i} className="card h-[380px] animate-pulse bg-night-3/50" />
              ))
            : favoritos.map((producto, i) => (
                <Aparecer key={producto.id} delay={i * 0.06}>
                  <TarjetaFavorito producto={producto} />
                </Aparecer>
              ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Tarjeta de escaparate: foto grande, nombre y descripción. Toda ella es un
 * enlace a la carta — el usuario ya intenta pulsar la foto, así que el
 * destino debe ser el mismo que el del botón.
 */
function TarjetaFavorito({ producto }: { producto: Producto }) {
  return (
    <Link
      href="/carta"
      className="card card-hover group flex h-full flex-col overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sugu"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-night-3">
        <Image
          src={producto.imagen}
          alt={producto.nombre}
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 300px"
          className="object-cover transition-transform duration-700 ease-premium group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-night-2 via-transparent to-transparent opacity-80" />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-bold leading-snug tracking-tight">{producto.nombre}</h3>
        <p className="mt-2.5 flex-1 text-[14px] leading-relaxed text-bone-dim">
          {producto.descripcion}
        </p>
        <span className="mt-5 inline-flex items-center gap-2 text-[14px] font-semibold text-sugu">
          Verlo en la carta
          <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1.5" />
        </span>
      </div>
    </Link>
  );
}
