'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Gamepad2, Gift, Percent } from 'lucide-react';
import {
  canjear,
  listarRecompensas,
  misCanjes,
  type Canje,
  type Recompensa,
} from '@/lib/tienda';

const ICONO = {
  descuento: Percent,
  producto: Gift,
  juego: Gamepad2,
} as const;

const ESTADO_CANJE: Record<Canje['estado'], string> = {
  disponible: 'Sin usar',
  usado: 'Usado',
  entregado: 'Entregado',
};

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' });

/**
 * Canjes dentro del perfil: qué puedo pedir con mis puntos y qué he pedido ya.
 *
 * `alCanjear` avisa al perfil para que recargue la tarjeta: el saldo cambia en
 * el mismo momento y la cifra de arriba tiene que reflejarlo.
 */
export function CanjesPerfil({ saldo, alCanjear }: { saldo: number; alCanjear: () => void }) {
  const [catalogo, setCatalogo] = useState<Recompensa[] | null>(null);
  const [mios, setMios] = useState<Canje[]>([]);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const cargar = async () => {
    const [c, m] = await Promise.all([
      listarRecompensas().catch(() => []),
      misCanjes().catch(() => []),
    ]);
    setCatalogo(c);
    setMios(m);
  };

  useEffect(() => {
    void cargar();
  }, []);

  const pedir = async (r: Recompensa) => {
    setTrabajando(r.id);
    setAviso(null);
    const res = await canjear(r.id);
    setTrabajando(null);

    if (!res.ok) {
      setAviso({ ok: false, texto: res.mensaje ?? 'No se pudo canjear' });
      return;
    }
    setAviso({
      ok: true,
      texto: res.codigo
        ? `¡Listo! Tu código es ${res.codigo}`
        : '¡Listo! Muestra el canje en el local para recogerlo.',
    });
    void cargar();
    alCanjear();
  };

  const copiar = (codigo: string) => {
    void navigator.clipboard.writeText(codigo);
    setCopiado(codigo);
    setTimeout(() => setCopiado(null), 2000);
  };

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold tracking-tight">Canjea tus puntos</h2>

      {aviso && (
        <p
          className={`mt-4 rounded-xl border px-4 py-3 text-[13px] ${
            aviso.ok
              ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-400'
              : 'border-sugu/40 bg-sugu/10 text-sugu'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {!catalogo ? (
        <p className="card mt-5 p-12 text-center text-sm text-bone-dim">Cargando canjes…</p>
      ) : catalogo.length === 0 ? (
        <p className="card mt-5 p-12 text-center text-sm text-bone-dim">
          Todavía no hay canjes disponibles. Vuelve pronto.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {catalogo.map((r) => {
            const Icono = ICONO[r.tipo];
            const alcanza = saldo >= r.costo_puntos;
            return (
              <article
                key={r.id}
                className={`card flex flex-col p-6 transition-opacity ${alcanza ? '' : 'opacity-60'}`}
              >
                <header className="flex items-start gap-4">
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-sugu/10">
                    <Icono className="h-5 w-5 text-sugu" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold">{r.nombre}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-bone-dim">
                      {r.descripcion}
                    </p>
                  </div>
                </header>

                <footer className="mt-6 flex items-center justify-between gap-4">
                  <span className="text-sm font-bold tabular-nums">
                    {r.costo_puntos.toLocaleString('es')}{' '}
                    <span className="text-[12px] font-normal text-bone-dim">puntos</span>
                  </span>
                  <button
                    onClick={() => void pedir(r)}
                    disabled={!alcanza || trabajando === r.id}
                    className="btn-primary px-6 py-2.5 text-[13px] disabled:pointer-events-none disabled:opacity-40"
                  >
                    {trabajando === r.id ? 'Canjeando…' : alcanza ? 'Canjear' : 'Te faltan puntos'}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {mios.length > 0 && (
        <>
          <h3 className="mt-10 text-lg font-bold tracking-tight">Mis canjes</h3>
          <ul className="mt-4 grid gap-3">
            {mios.map((c) => (
              <li
                key={c.id}
                className="card flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{c.nombre}</p>
                  <p className="mt-0.5 text-[12px] text-bone-dim">
                    {fecha(c.creado)} · −{c.costo_puntos} puntos · {ESTADO_CANJE[c.estado]}
                  </p>
                </div>

                {c.codigo ? (
                  <button
                    onClick={() => copiar(c.codigo!)}
                    className="inline-flex items-center gap-2 rounded-xl border border-sugu/40 bg-sugu/10 px-4 py-2 font-mono text-sm tracking-widest transition-colors hover:bg-sugu/20"
                    title="Copiar código"
                  >
                    {c.codigo}
                    {copiado === c.codigo ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="text-[12px] text-bone-dim">Recógelo en el local</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
