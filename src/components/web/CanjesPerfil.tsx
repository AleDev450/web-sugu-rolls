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
import { SeccionPerfil, Vacio } from './SeccionPerfil';

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
    <SeccionPerfil
      titulo="Canjea tus puntos"
      icono={Gift}
      accion={
        <span className="text-[13px] text-bone-dim">
          Tienes <b className="text-white">{saldo.toLocaleString('es')}</b> puntos
        </span>
      }
    >
      {aviso && (
        <p
          className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${
            aviso.ok
              ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-400'
              : 'border-sugu/40 bg-sugu/10 text-sugu'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {!catalogo ? (
        <p className="py-10 text-center text-sm text-bone-dim">Cargando canjes…</p>
      ) : catalogo.length === 0 ? (
        <Vacio icono={Gift} texto="Todavía no hay canjes disponibles. Vuelve pronto." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {catalogo.map((r) => {
            const Icono = ICONO[r.tipo];
            const alcanza = saldo >= r.costo_puntos;
            return (
              <article
                key={r.id}
                className="flex flex-col justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20"
              >
                <header className="flex items-start gap-3.5">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                    <Icono className="h-4.5 w-4.5 text-sugu" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold leading-tight">{r.nombre}</h3>
                    <p className="mt-1 text-[12.5px] leading-snug text-bone-dim">
                      {r.descripcion}
                    </p>
                  </div>
                </header>

                <footer className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[15px] font-bold tabular-nums">
                    {r.costo_puntos.toLocaleString('es')}{' '}
                    <span className="text-[12px] font-normal text-bone-dim">puntos</span>
                  </span>
                  {/*
                    Deshabilitado con borde y texto atenuado, no con opacidad
                    global: bajarle la opacidad al botón rojo lo dejaba
                    ilegible sobre el fondo negro.
                  */}
                  <button
                    onClick={() => void pedir(r)}
                    disabled={!alcanza || trabajando === r.id}
                    className={
                      alcanza
                        ? 'btn-primary !px-6 !py-2.5 text-[13px]'
                        : 'cursor-not-allowed rounded-full border border-white/10 px-5 py-2.5 text-[13px] text-bone-dim'
                    }
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
          <h3 className="mt-8 text-[11px] font-bold uppercase tracking-[0.2em] text-bone-dim">
            Mis canjes
          </h3>
          <ul className="mt-4 grid gap-3">
            {mios.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
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
    </SeccionPerfil>
  );
}
