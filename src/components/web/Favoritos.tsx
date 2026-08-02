'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FAVORITOS, type Producto } from '@/data/productos';
import { texto } from '@/data/secciones';
import { traerFavoritos } from '@/lib/contenido';
import { Aparecer, TituloSeccion } from './Seccion';
import { ProductoCard } from './ProductoCard';
import { useSeccion } from './useSeccion';

/**
 * Los rolls más pedidos. Arranca con los datos locales y los sustituye por
 * los del panel en cuanto responde la base de datos: así no hay parpadeo ni
 * hueco mientras carga.
 */
export function Favoritos() {
  const [favoritos, setFavoritos] = useState<Producto[]>(FAVORITOS);
  const s = useSeccion('favoritos');

  useEffect(() => {
    void traerFavoritos().then(setFavoritos);
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

        <div className="mt-20 grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {favoritos.map((producto, i) => (
            <Aparecer key={producto.id} delay={i * 0.06}>
              <ProductoCard producto={producto} />
            </Aparecer>
          ))}
        </div>
      </div>
    </section>
  );
}
