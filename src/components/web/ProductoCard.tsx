'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, Plus } from 'lucide-react';
import { soles, type Producto } from '@/data/productos';
import { useCartStore } from '@/store/useCartStore';

const COLOR_ETIQUETA: Record<string, string> = {
  'Más pedido': 'bg-sugu text-white',
  Nuevo: 'bg-white text-night',
  Picante: 'bg-sugu-deep text-white',
  Vegetariano: 'bg-emerald-600 text-white',
};

export function ProductoCard({ producto }: { producto: Producto }) {
  const agregar = useCartStore((s) => s.agregar);
  const [agregado, setAgregado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (temporizador.current && clearTimeout(temporizador.current)), []);

  const alAgregar = () => {
    agregar(producto);
    setAgregado(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAgregado(false), 1400);
  };

  return (
    <article className="card card-hover group flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-night-3">
        <Image
          src={producto.imagen}
          alt={producto.nombre}
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 300px"
          className="object-cover transition-transform duration-700 ease-premium group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-night-2 via-transparent to-transparent opacity-80" />

        {producto.etiqueta && (
          <span
            className={`absolute left-4 top-4 rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
              COLOR_ETIQUETA[producto.etiqueta] ?? 'bg-white text-night'
            }`}
          >
            {producto.etiqueta}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-7">
        <h3 className="text-lg font-bold leading-snug tracking-tight">{producto.nombre}</h3>
        <p className="mt-2.5 flex-1 text-[14px] leading-relaxed text-bone-dim">
          {producto.descripcion}
        </p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-2xl font-extrabold tracking-tight text-sugu">
            {soles(producto.precio)}
          </span>
          <button
            onClick={alAgregar}
            className={`flex h-12 w-12 flex-none items-center justify-center rounded-full text-white transition-all duration-500 ease-premium hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sugu ${
              agregado ? 'scale-110 bg-emerald-600' : 'bg-sugu hover:bg-sugu-glow'
            }`}
            aria-label={`Agregar ${producto.nombre} al carrito`}
          >
            {agregado ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </article>
  );
}
