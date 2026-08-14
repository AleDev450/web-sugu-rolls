'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, Plus } from 'lucide-react';
import { soles, type Producto, type OpcionesConPrecio } from '@/data/productos';
import { useCartStore } from '@/store/useCartStore';
import { Configurador } from './Configurador';

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

  /*
   * Presentaciones (por 5, por 10…). Sin ellas el producto se comporta como
   * siempre: un precio y un botón. Con ellas hay que elegir cantidad antes de
   * añadir, y se preselecciona la primera —la más pequeña— porque es la
   * entrada natural: quien quiera más sube, quien dude no se topa de golpe
   * con el precio mayor.
   */
  const presentaciones = producto.presentaciones ?? [];
  const [elegida, setElegida] = useState(0);
  const presentacion = presentaciones[elegida];
  const precio = presentacion?.precio ?? producto.precio;

  /** Productos configurables (bowls): el botón abre el armador. */
  const configurable = (producto.opciones?.length ?? 0) > 0;
  const [armando, setArmando] = useState(false);

  useEffect(() => () => void (temporizador.current && clearTimeout(temporizador.current)), []);

  const confirmar = (opciones?: OpcionesConPrecio, precioFinal?: number) => {
    // con extras el precio final ya no es el de la presentación: lo trae el configurador
    agregar(producto, presentacion?.piezas, precioFinal ?? presentacion?.precio, opciones);
    setArmando(false);
    setAgregado(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAgregado(false), 1400);
  };

  const alAgregar = () => (configurable ? setArmando(true) : confirmar());

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

        {presentaciones.length > 0 && (
          <div
            className="mt-5 flex flex-wrap gap-2"
            role="group"
            aria-label={`Cantidad de ${producto.nombre}`}
          >
            {presentaciones.map((p, i) => (
              <button
                key={p.piezas}
                onClick={() => setElegida(i)}
                aria-pressed={i === elegida}
                className={`rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                  i === elegida
                    ? 'border-sugu bg-sugu text-white'
                    : 'border-white/15 text-bone-dim hover:border-white/40 hover:text-white'
                }`}
              >
                {p.piezas} u.
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-2xl font-extrabold tracking-tight text-sugu">
            {soles(precio)}
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

      {configurable && (
        <Configurador
          producto={producto}
          precio={precio}
          piezas={presentacion?.piezas}
          abierto={armando}
          alCerrar={() => setArmando(false)}
          alConfirmar={confirmar}
        />
      )}
    </article>
  );
}
