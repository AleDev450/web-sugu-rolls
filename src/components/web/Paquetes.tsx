'use client';

import Image from 'next/image';
import { Check } from 'lucide-react';
import { PAQUETES, soles } from '@/data/productos';
import { useCartStore } from '@/store/useCartStore';
import { Aparecer, TituloSeccion } from './Seccion';

export function Paquetes() {
  const agregar = useCartStore((s) => s.agregar);

  return (
    <section id="paquetes" className="wrap section scroll-mt-24">
      <TituloSeccion
        etiqueta="Para compartir"
        titulo="Paquetes para"
        manuscrito="compartir"
        bajada="Elige el paquete perfecto para disfrutar con amigos, familia o compañeros de trabajo."
      />

      <div className="mt-20 grid gap-8 lg:grid-cols-3">
        {PAQUETES.map((paquete, i) => (
          <Aparecer key={paquete.id} delay={i * 0.08} className="h-full">
            <article
              className={`card card-hover relative flex h-full flex-col overflow-hidden ${
                paquete.masPedido
                  ? 'border-sugu/50 shadow-[0_28px_70px_-30px_rgba(227,19,35,0.7)] lg:-mt-4 lg:mb-4'
                  : ''
              }`}
            >
              {paquete.masPedido && (
                <span className="absolute right-4 top-4 z-10 rounded-full bg-sugu px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
                  Más pedido
                </span>
              )}

              <div className="relative aspect-[16/10] overflow-hidden bg-night-3">
                <Image
                  src={paquete.imagen}
                  alt={paquete.nombre}
                  fill
                  sizes="(max-width: 1024px) 100vw, 400px"
                  className="object-cover transition-transform duration-700 ease-premium hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-night-2 to-transparent" />
              </div>

              <div className="flex flex-1 flex-col p-10">
                <h3 className="text-2xl font-bold tracking-tight">{paquete.nombre}</h3>
                <p className="mt-2 text-[14px] text-bone-dim">{paquete.ideal}</p>

                <p className="mt-8 text-5xl font-extrabold tracking-tight text-sugu">
                  {soles(paquete.precio)}
                </p>

                <ul className="mt-9 flex-1 space-y-4">
                  {paquete.incluye.map((linea) => (
                    <li key={linea} className="flex items-start gap-3.5 text-[15px]">
                      <Check className="mt-0.5 h-4.5 w-4.5 flex-none text-sugu" />
                      <span className="text-bone-dim">{linea}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() =>
                    agregar({
                      id: paquete.id,
                      nombre: paquete.nombre,
                      precio: paquete.precio,
                      imagen: paquete.imagen,
                    })
                  }
                  className={`mt-10 w-full ${paquete.masPedido ? 'btn-primary' : 'btn-ghost'}`}
                >
                  Pedir paquete
                </button>
              </div>
            </article>
          </Aparecer>
        ))}
      </div>
    </section>
  );
}
