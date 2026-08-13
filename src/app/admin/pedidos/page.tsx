'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Ban, Bike, ImageIcon, RefreshCw, Truck } from 'lucide-react';
import {
  cambiarEstadoPedido,
  confirmarPago,
  fijarDelivery,
  listarPedidos,
  verComprobante,
  type EstadoPedido,
  type PedidoAdmin,
} from '@/lib/admin';
import { Aviso, Cargando, Encabezado } from '@/components/admin/ui';

const FILTROS: { id: EstadoPedido | 'todos'; label: string }[] = [
  { id: 'pendiente', label: 'Por cobrar' },
  { id: 'pagado', label: 'Pagados' },
  { id: 'entregado', label: 'Entregados' },
  { id: 'cancelado', label: 'Cancelados' },
  { id: 'todos', label: 'Todos' },
];

const COLOR_ESTADO: Record<EstadoPedido, string> = {
  pendiente: 'bg-amber-500/20 text-amber-400',
  pagado: 'bg-emerald-600/20 text-emerald-400',
  entregado: 'bg-sky-600/20 text-sky-400',
  cancelado: 'bg-white/10 text-bone-dim',
};

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/**
 * Pedidos de la web. El pago se confirma a mano —Yape, transferencia o
 * efectivo— y ES ESE BOTÓN el que acredita los puntos al cliente.
 */
export default function PedidosAdmin() {
  const [items, setItems] = useState<PedidoAdmin[] | null>(null);
  const [filtro, setFiltro] = useState<EstadoPedido | 'todos'>('pendiente');
  const [trabajando, setTrabajando] = useState<string | null>(null);
  /** costo de reparto en edición, por pedido */
  const [envios, setEnvios] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = async (f: EstadoPedido | 'todos') => {
    setItems(null);
    try {
      setItems(await listarPedidos(f === 'todos' ? undefined : f));
    } catch (e) {
      setItems([]);
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  useEffect(() => {
    void cargar(filtro);
  }, [filtro]);

  const cobrar = async (p: PedidoAdmin) => {
    setTrabajando(p.id);
    try {
      const puntos = await confirmarPago(p.id);
      setAviso({
        tipo: 'ok',
        texto: `Pedido #${p.numero} cobrado. Se acreditaron ${puntos} puntos a ${p.nombre}.`,
      });
      void cargar(filtro);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setTrabajando(null);
    }
  };

  const mover = async (p: PedidoAdmin, estado: EstadoPedido) => {
    setTrabajando(p.id);
    try {
      await cambiarEstadoPedido(p.id, estado);
      setAviso({ tipo: 'ok', texto: `Pedido #${p.numero}: ${estado}.` });
      void cargar(filtro);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setTrabajando(null);
    }
  };

  const guardarEnvio = async (p: PedidoAdmin) => {
    const monto = Number(envios[p.id] ?? p.delivery);
    if (!Number.isFinite(monto) || monto < 0) return;
    setTrabajando(p.id);
    try {
      await fijarDelivery(p.id, monto);
      setAviso({
        tipo: 'ok',
        texto: `Pedido #${p.numero}: delivery ${soles(monto)}.`,
      });
      void cargar(filtro);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setTrabajando(null);
    }
  };

  const abrirComprobante = async (ruta: string) => {
    try {
      window.open(await verComprobante(ruta), '_blank', 'noopener');
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  const porCobrar = items?.filter((p) => p.estado === 'pendiente').length ?? 0;

  return (
    <>
      <Encabezado
        titulo="Pedidos"
        bajada={
          items
            ? `${items.length} pedidos en esta vista${porCobrar ? ` · ${porCobrar} esperando pago` : ''}.`
            : 'Cargando pedidos…'
        }
        accion={
          <button onClick={() => void cargar(filtro)} className="btn-ghost">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
              filtro === f.id ? 'bg-sugu text-white' : 'bg-white/5 text-bone-dim hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!items ? (
        <Cargando />
      ) : items.length === 0 ? (
        <p className="card p-16 text-center text-sm text-bone-dim">
          No hay pedidos en esta vista.
        </p>
      ) : (
        <div className="grid gap-5">
          {items.map((p) => (
            <article key={p.id} className="card p-7">
              <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold">Pedido #{p.numero}</h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${COLOR_ESTADO[p.estado]}`}
                    >
                      {p.estado}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-bone-dim">{fecha(p.creado)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold tracking-tight">
                    {soles(p.total + p.delivery)}
                  </p>
                  {p.delivery > 0 && (
                    <p className="mt-0.5 text-[12px] text-bone-dim">
                      {soles(p.total)} + {soles(p.delivery)} de envío
                    </p>
                  )}
                </div>
              </header>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div className="space-y-1.5 text-[13px]">
                  <p className="font-semibold text-white">{p.nombre}</p>
                  {p.telefono && (
                    <p>
                      <a href={`tel:${p.telefono}`} className="text-bone-dim hover:text-sugu">
                        {p.telefono}
                      </a>
                    </p>
                  )}
                  {p.correo && <p className="text-bone-dim">{p.correo}</p>}
                  <p className="text-bone-dim">{p.direccion || 'Sin dirección'}</p>
                  {p.nota && <p className="pt-2 italic text-bone-dim">“{p.nota}”</p>}
                </div>

                <ul className="space-y-1.5 text-[13px]">
                  {p.items.map((i, n) => (
                    <li key={n}>
                      <div className="flex justify-between gap-4">
                        <span>
                          <span className="text-bone-dim">{i.cantidad}×</span> {i.nombre}
                        </span>
                        <span className="flex-none tabular-nums text-bone-dim">
                          {soles(Number(i.precio) * i.cantidad)}
                        </span>
                      </div>

                      {/* lo que hay que preparar: por grupo, no todo junto */}
                      {i.opciones && Object.keys(i.opciones).length > 0 && (
                        <ul className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                          {Object.entries(i.opciones)
                            .filter(([, v]) => v.length > 0)
                            .map(([grupo, valores]) => (
                              <li key={grupo} className="text-[12px] text-bone-dim">
                                <span className="text-white/40">{grupo}:</span>{' '}
                                {valores.join(', ')}
                              </li>
                            ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/*
                Costo de reparto y comprobante: lo que hace falta ANTES de
                confirmar el pago, por eso van juntos y encima del botón.
              */}
              <div className="mt-6 flex flex-wrap items-end gap-4 border-t border-white/10 pt-5">
                <label className="flex-none">
                  <span className="mb-1.5 flex items-center gap-2 text-[11px] text-bone-dim">
                    <Bike className="h-3.5 w-3.5" />
                    Costo de delivery
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.50"
                      value={envios[p.id] ?? String(p.delivery)}
                      onChange={(e) => setEnvios({ ...envios, [p.id]: e.target.value })}
                      className="w-28 rounded-lg border border-white/10 bg-night px-3 py-2 text-sm outline-none transition-colors focus:border-sugu"
                    />
                    <button
                      onClick={() => void guardarEnvio(p)}
                      disabled={trabajando === p.id}
                      className="rounded-lg border border-white/10 px-4 text-[13px] transition-colors hover:border-sugu/50 hover:text-sugu disabled:pointer-events-none disabled:opacity-40"
                    >
                      Guardar
                    </button>
                  </div>
                </label>

                <div className="flex-1">
                  <span className="mb-1.5 block text-[11px] text-bone-dim">Comprobante</span>
                  {p.comprobante ? (
                    <button
                      onClick={() => void abrirComprobante(p.comprobante!)}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-4 py-2 text-[13px] text-emerald-400 transition-colors hover:bg-emerald-600/20"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Ver el Yape adjunto
                    </button>
                  ) : (
                    <p className="py-2 text-[13px] text-amber-400">Todavía sin adjuntar</p>
                  )}
                </div>
              </div>

              <footer className="mt-4 flex flex-wrap items-center gap-3">
                {p.estado === 'pendiente' && (
                  <button
                    onClick={() => void cobrar(p)}
                    disabled={trabajando === p.id}
                    className="btn-primary disabled:pointer-events-none disabled:opacity-40"
                  >
                    <BadgeCheck className="h-4 w-4" />
                    Confirmar pago
                  </button>
                )}

                {p.estado === 'pagado' && (
                  <button
                    onClick={() => void mover(p, 'entregado')}
                    disabled={trabajando === p.id}
                    className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Truck className="h-4 w-4" />
                    Marcar entregado
                  </button>
                )}

                {p.estado !== 'cancelado' && (
                  <button
                    onClick={() => void mover(p, 'cancelado')}
                    disabled={trabajando === p.id}
                    className="inline-flex items-center gap-2 text-[13px] text-bone-dim transition-colors hover:text-sugu disabled:opacity-40"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancelar
                  </button>
                )}

                {p.puntos > 0 && (
                  <span className="ml-auto text-[13px] text-emerald-400">
                    +{p.puntos} puntos acreditados
                  </span>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
