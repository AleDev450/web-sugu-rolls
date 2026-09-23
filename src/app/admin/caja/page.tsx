'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { listarCaja, type PedidoCaja } from '@/lib/admin';
import { Aviso, Cargando, Encabezado } from '@/components/admin/ui';
import {
  NOMBRE_PRODUCTO,
  NOMBRE_PROMO,
  type ClaveProducto,
  type Pedido,
  type PromoMaki,
  descargarExcel,
  describirLinea,
  diaLocal,
  fechaCorta,
  hora,
  soles,
  unidades,
} from '@/lib/caja';

const POR_PAGINA = 20;

const claseFecha =
  'rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-bone-dim outline-none transition-colors [color-scheme:dark] focus:border-sugu';

/** La fila de Supabase con la forma que esperan los ayudantes de la caja. */
function aPedido(p: PedidoCaja): Pedido {
  return {
    id: p.id,
    creado: p.creado,
    cliente: p.cliente,
    vendedor: p.vendedor,
    lineas: p.lineas.map((l) => ({
      producto: l.producto as ClaveProducto,
      promo: (l.promo ?? null) as PromoMaki | null,
      sabores: l.sabores ?? [],
      cantidad: l.cantidad,
      unitario: Number(l.unitario),
      total: Number(l.total),
    })),
    total: Number(p.total),
    metodo: p.metodo,
    pagado: p.pagado,
    entregado: p.entregado,
  };
}

/**
 * Caja de feria vista desde el panel.
 *
 * Es SOLO LECTURA a propósito: la tablet del puesto es la fuente y
 * sincroniza en un único sentido, así que una corrección hecha aquí la
 * pisaría el siguiente cambio que se tocara allá. Lo que se arregla, se
 * arregla en la caja.
 */
export default function CajaAdmin() {
  const hoy = diaLocal(new Date());
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [vendedor, setVendedor] = useState('todos');
  const [items, setItems] = useState<PedidoCaja[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setItems(null);
    setError(null);
    try {
      setItems(await listarCaja(desde || undefined, hasta || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la caja.');
      setItems([]);
    }
  }, [desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const vendedores = useMemo(() => {
    const nombres = new Set((items ?? []).map((p) => p.vendedor.trim()).filter(Boolean));
    return Array.from(nombres).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visibles = useMemo(() => {
    const base = items ?? [];
    return vendedor === 'todos' ? base : base.filter((p) => p.vendedor.trim() === vendedor);
  }, [items, vendedor]);

  const resumen = useMemo(() => {
    const total = visibles.reduce((s, p) => s + p.total, 0);
    const cobrado = visibles.filter((p) => p.pagado).reduce((s, p) => s + p.total, 0);
    const piezas = visibles.reduce((s, p) => s + unidades(aPedido(p).lineas), 0);
    return { total, cobrado, pendiente: total - cobrado, piezas };
  }, [visibles]);

  /** Cuánto vendió cada quien: es la pregunta de después de la feria. */
  const porVendedor = useMemo(() => {
    const mapa = new Map<string, { pedidos: number; unidades: number; total: number; cobrado: number }>();
    for (const p of visibles) {
      const clave = p.vendedor.trim() || '— sin nombre —';
      const fila = mapa.get(clave) ?? { pedidos: 0, unidades: 0, total: 0, cobrado: 0 };
      fila.pedidos += 1;
      fila.unidades += unidades(aPedido(p).lineas);
      fila.total += p.total;
      if (p.pagado) fila.cobrado += p.total;
      mapa.set(clave, fila);
    }
    return Array.from(mapa.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [visibles]);

  /** Qué salió más: se agrupa por producto y promo, que es como se cobra. */
  const porProducto = useMemo(() => {
    const mapa = new Map<string, { unidades: number; total: number }>();
    for (const p of visibles) {
      for (const l of aPedido(p).lineas) {
        const nombre = NOMBRE_PRODUCTO[l.producto] ?? l.producto;
        const clave = l.promo ? `${nombre} ${NOMBRE_PROMO[l.promo]}` : nombre;
        const fila = mapa.get(clave) ?? { unidades: 0, total: 0 };
        fila.unidades += l.cantidad;
        fila.total += l.total;
        mapa.set(clave, fila);
      }
    }
    return Array.from(mapa.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [visibles]);

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const enPagina = visibles.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA);

  const etiquetaArchivo = desde === hasta ? desde || 'todo' : `${desde || 'inicio'}_${hasta || 'hoy'}`;

  return (
    <>
      <Encabezado
        titulo="Caja de feria"
        bajada="Ventas cobradas en el puesto desde /calculator. Solo lectura: la tablet manda."
        accion={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void cargar()}
              className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
            <Link
              href="/calculator"
              className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir la caja
            </Link>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={desde}
          onChange={(e) => {
            setDesde(e.target.value);
            setPagina(1);
          }}
          aria-label="Desde"
          className={claseFecha}
        />
        <span className="text-[13px] text-bone-dim">a</span>
        <input
          type="date"
          value={hasta}
          onChange={(e) => {
            setHasta(e.target.value);
            setPagina(1);
          }}
          aria-label="Hasta"
          className={claseFecha}
        />
        <select
          value={vendedor}
          onChange={(e) => {
            setVendedor(e.target.value);
            setPagina(1);
          }}
          aria-label="Vendedor"
          className={claseFecha}
        >
          <option value="todos">Todos los vendedores</option>
          {vendedores.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        {visibles.length > 0 && (
          <button
            type="button"
            onClick={() => descargarExcel(visibles.map(aPedido), etiquetaArchivo)}
            className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-600/15 px-4 py-2 text-[13px] font-semibold text-emerald-300"
          >
            <Download className="h-4 w-4" />
            Excel ({visibles.length})
          </button>
        )}
      </div>

      {error && <Aviso tipo="error" texto={error} />}

      {items === null ? (
        <Cargando />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { et: 'Venta', valor: soles(resumen.total), color: 'text-sugu-glow' },
              { et: 'Cobrado', valor: soles(resumen.cobrado), color: 'text-emerald-400' },
              { et: 'Por cobrar', valor: soles(resumen.pendiente), color: 'text-amber-400' },
              {
                et: 'Pedidos',
                valor: `${visibles.length} · ${resumen.piezas} und`,
                color: 'text-bone',
              },
            ].map((t) => (
              <div key={t.et} className="rounded-2xl border border-white/10 bg-night-2 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-bone-dim">{t.et}</p>
                <p className={`mt-1 text-2xl font-bold ${t.color}`}>{t.valor}</p>
              </div>
            ))}
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-sm text-bone-dim">
              No hay ventas de caja en ese rango.
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-night-2 p-4">
                <h2 className="mb-3 text-sm font-semibold">Por vendedor</h2>
                <table className="w-full text-[13px]">
                  <thead className="text-[11px] uppercase tracking-wider text-bone-dim">
                    <tr>
                      <th className="pb-2 text-left font-medium">Vendedor</th>
                      <th className="pb-2 text-right font-medium">Pedidos</th>
                      <th className="pb-2 text-right font-medium">Und</th>
                      <th className="pb-2 text-right font-medium">Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porVendedor.map(([nombre, f]) => (
                      <tr key={nombre} className="border-t border-white/5">
                        <td className="py-2 font-medium">{nombre}</td>
                        <td className="py-2 text-right tabular-nums text-bone-dim">{f.pedidos}</td>
                        <td className="py-2 text-right tabular-nums text-bone-dim">{f.unidades}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {soles(f.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="rounded-2xl border border-white/10 bg-night-2 p-4">
                <h2 className="mb-3 text-sm font-semibold">Por producto</h2>
                <table className="w-full text-[13px]">
                  <thead className="text-[11px] uppercase tracking-wider text-bone-dim">
                    <tr>
                      <th className="pb-2 text-left font-medium">Producto</th>
                      <th className="pb-2 text-right font-medium">Und</th>
                      <th className="pb-2 text-right font-medium">Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porProducto.map(([nombre, f]) => (
                      <tr key={nombre} className="border-t border-white/5">
                        <td className="py-2 font-medium">{nombre}</td>
                        <td className="py-2 text-right tabular-nums text-bone-dim">{f.unidades}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {soles(f.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="lg:col-span-2">
                <h2 className="mb-3 text-sm font-semibold">Pedidos</h2>
                <ul className="grid gap-2">
                  {enPagina.map((p) => (
                    <li key={p.id} className="rounded-2xl border border-white/10 bg-night-2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] text-bone-dim">
                            {fechaCorta(p.creado)} · {hora(p.creado)} · {p.cliente}
                            {p.vendedor && ` · atendió ${p.vendedor}`}
                          </p>
                          {aPedido(p).lineas.map((l, i) => (
                            <p key={i} className="mt-0.5 text-[13px] font-semibold">
                              {describirLinea(l)}
                            </p>
                          ))}
                          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span
                              className={`rounded-full px-2 py-0.5 font-semibold ${
                                p.pagado
                                  ? 'bg-emerald-600/20 text-emerald-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {p.pagado ? 'Pagado' : 'Por cobrar'}
                            </span>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-bone-dim">
                              {p.metodo === 'yape' ? 'Yape' : 'Efectivo'}
                            </span>
                            {p.entregado && (
                              <span className="rounded-full bg-sky-600/20 px-2 py-0.5 font-semibold text-sky-400">
                                Entregado
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="shrink-0 text-lg font-bold tabular-nums">
                          {soles(p.total)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                {totalPaginas > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPagina(paginaSegura - 1)}
                      disabled={paginaSegura === 1}
                      className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold disabled:opacity-30"
                    >
                      Anterior
                    </button>
                    <span className="text-[12px] text-bone-dim">
                      {paginaSegura} / {totalPaginas}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPagina(paginaSegura + 1)}
                      disabled={paginaSegura === totalPaginas}
                      className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold disabled:opacity-30"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}
