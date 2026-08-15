'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, KeyRound, Trophy, UtensilsCrossed } from 'lucide-react';
import { estadisticas, listarPaquetes, listarProductos } from '@/lib/admin';
import { Cargando, Encabezado } from '@/components/admin/ui';

interface Resumen {
  productos: number;
  paquetes: number;
  codigosDisponibles: number;
  codigosUsados: number;
  partidas: number;
  mejorPuntaje: number | null;
}

export default function AdminInicio() {
  const [r, setR] = useState<Resumen | null>(null);

  useEffect(() => {
    (async () => {
      const [productos, paquetes] = await Promise.all([
        listarProductos().catch(() => []),
        listarPaquetes().catch(() => []),
      ]);
      const stats = await estadisticas().catch(() => null);

      setR({
        productos: productos.length,
        paquetes: paquetes.length,
        codigosDisponibles: Number(stats?.codigos_disponibles ?? 0),
        codigosUsados: Number(stats?.codigos_usados ?? 0),
        partidas: Number(stats?.partidas_jugadas ?? 0),
        mejorPuntaje: stats?.mejor_puntaje ?? null,
      });
    })();
  }, []);

  if (!r) return <Cargando />;

  const tarjetas = [
    { titulo: 'Productos', valor: r.productos, icono: UtensilsCrossed, href: '/admin/productos' },
    { titulo: 'Promociones', valor: r.paquetes, icono: Boxes, href: '/admin/paquetes' },
    {
      titulo: 'Códigos sin usar',
      valor: r.codigosDisponibles,
      icono: KeyRound,
      href: '/admin/codigos',
    },
  ];

  return (
    <>
      <Encabezado
        titulo="Resumen"
        bajada="Estado del contenido de la web y del juego."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {tarjetas.map(({ titulo, valor, icono: Icono, href }) => (
          <Link
            key={titulo}
            href={href}
            className="card card-hover flex items-center gap-5 p-7"
          >
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-sugu/10">
              <Icono className="h-6 w-6 text-sugu" />
            </span>
            <div>
              <p className="text-3xl font-extrabold tracking-tight">{valor}</p>
              <p className="mt-0.5 text-[13px] text-bone-dim">{titulo}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <div className="card p-7">
          <p className="text-[11px] uppercase tracking-widest text-bone-dim">Códigos usados</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{r.codigosUsados}</p>
        </div>
        <Link href="/admin/ranking" className="card card-hover p-7">
          <p className="text-[11px] uppercase tracking-widest text-bone-dim">Partidas jugadas</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{r.partidas}</p>
        </Link>
        <Link href="/admin/ranking" className="card card-hover p-7">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-bone-dim">
            <Trophy className="h-3.5 w-3.5 text-sugu" />
            Mejor puntaje
          </p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-sugu">
            {r.mejorPuntaje?.toLocaleString('es') ?? '—'}
          </p>
        </Link>
      </div>
    </>
  );
}
