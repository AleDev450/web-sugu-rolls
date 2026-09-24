'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChefHat, Download, ExternalLink, RefreshCw, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import {
  asignarVendedorACierre,
  listarCaja,
  traerClaveCocina,
  type PedidoCaja,
} from '@/lib/admin';
import { Aviso, Cargando, Encabezado } from '@/components/admin/ui';
import {
  NOMBRE_METODO,
  NOMBRE_PRODUCTO,
  type ClaveProducto,
  type Pedido,
  arqueoPorMetodo,
  buscarVariante,
  descargarExcel,
  dineroDe,
  rangoFechas,
  describirLinea,
  diaLocal,
  fechaCorta,
  hora,
  paraArchivo,
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
    numero: p.numero ?? 0,
    creado: p.creado,
    cliente: p.cliente,
    vendedor: p.vendedor,
    cierre: p.cierre ?? '',
    nota: p.nota ?? '',
    lineas: p.lineas.map((l) => ({
      producto: l.producto as ClaveProducto,
      promo: l.promo ?? null,
      sabores: l.sabores ?? [],
      cantidad: l.cantidad,
      unitario: Number(l.unitario),
      total: Number(l.total),
    })),
    total: Number(p.total),
    metodo: p.metodo,
    montoYape: Number(p.monto_yape ?? 0),
    montoEfectivo: Number(p.monto_efectivo ?? 0),
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
  const [cierre, setCierre] = useState('todos');
  const [items, setItems] = useState<PedidoCaja[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  /** cierre al que se le está poniendo nombre de vendedor, y el nombre */
  const [asignando, setAsignando] = useState<string | null>(null);
  const [nombreVendedor, setNombreVendedor] = useState('');
  const [guardando, setGuardando] = useState(false);
  /** clave de cocina, para armar el enlace de cada cajero desde aquí */
  const [claveCocina, setClaveCocina] = useState('');
  const [copiado, setCopiado] = useState('');

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

  useEffect(() => {
    void traerClaveCocina().then((c) => setClaveCocina(c ?? ''));
  }, []);

  /*
   * El enlace de cocina de un cajero. Es el mismo que genera su caja; aquí
   * se rearma para poder repartir los dos sin ir celular por celular.
   */
  function enlaceCocinaDe(nombre: string): string {
    if (!claveCocina || typeof window === 'undefined') return '';
    return `${window.location.origin}/cocina?k=${claveCocina}&v=${encodeURIComponent(nombre)}`;
  }

  async function copiarCocina(nombre: string) {
    const enlace = enlaceCocinaDe(nombre);
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(nombre);
      setTimeout(() => setCopiado(''), 2000);
    } catch {
      setError('No se pudo copiar. Selecciona el enlace a mano.');
    }
  }

  async function guardarVendedorDelCierre(cierre: string) {
    const nombre = nombreVendedor.trim();
    if (!nombre) return;
    setGuardando(true);
    try {
      await asignarVendedorACierre(cierre, nombre);
      setAsignando(null);
      setNombreVendedor('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo asignar el vendedor.');
    } finally {
      setGuardando(false);
    }
  }

  const vendedores = useMemo(() => {
    const nombres = new Set((items ?? []).map((p) => p.vendedor.trim()).filter(Boolean));
    return Array.from(nombres).sort((a, b) => a.localeCompare(b));
  }, [items]);

  /**
   * Los cierres que hay en el rango. "abierta" son los cobros que la tablet
   * todavía no cerró: sirve para ver el turno en curso desde el panel.
   */
  const cierres = useMemo(() => {
    const nombres = new Set((items ?? []).map((p) => (p.cierre ?? '').trim()).filter(Boolean));
    return Array.from(nombres).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visibles = useMemo(() => {
    let base = items ?? [];
    if (vendedor !== 'todos') base = base.filter((p) => p.vendedor.trim() === vendedor);
    if (cierre === 'abierta') base = base.filter((p) => !(p.cierre ?? '').trim());
    else if (cierre !== 'todos') base = base.filter((p) => (p.cierre ?? '').trim() === cierre);
    return base;
  }, [items, vendedor, cierre]);

  const resumen = useMemo(() => {
    const total = visibles.reduce((s, p) => s + p.total, 0);
    const cobrados = visibles.filter((p) => p.pagado);
    // el canje se entrega pero no deja plata: no cuenta como cobrado
    const cobrado = cobrados.reduce((s, p) => s + dineroDe(p), 0);
    const piezas = visibles.reduce((s, p) => s + unidades(aPedido(p).lineas), 0);
    return {
      total,
      cobrado,
      pendiente: visibles.filter((p) => !p.pagado).reduce((s, p) => s + p.total, 0),
      piezas,
    };
  }, [visibles]);

  /** Arqueo: cuánto entró por cada vía. Es lo que se cuenta al cerrar. */
  const porMetodo = useMemo(() => arqueoPorMetodo(visibles.map(aPedido)), [visibles]);

  /*
   * El arqueo sin contar el canje tiene que dar exactamente lo cobrado. Si
   * no cuadra es que hay pedidos con el monto sin rellenar —pasó con cobros
   * subidos desde un celular con la página cacheada— y conviene verlo, no
   * que la caja parezca vacía en una vía y llena en el total.
   */
  const descuadre = useMemo(() => {
    const suma = porMetodo
      .filter((m) => m.metodo !== 'canje')
      .reduce((s, m) => s + m.monto, 0);
    return Math.round((resumen.cobrado - suma) * 100) / 100;
  }, [porMetodo, resumen.cobrado]);

  /**
   * Cada cierre con su fecha. Responde a "¿cuánto hice en la feria del
   * sábado?" sin tener que acordarse de qué día fue.
   */
  const porCierre = useMemo(() => {
    const mapa = new Map<string, { pedidos: PedidoCaja[] }>();
    for (const p of visibles) {
      const clave = (p.cierre ?? '').trim() || 'Caja sin cerrar';
      const fila = mapa.get(clave) ?? { pedidos: [] };
      fila.pedidos.push(p);
      mapa.set(clave, fila);
    }
    return Array.from(mapa.entries())
      .map(([nombre, { pedidos }]) => ({
        nombre,
        abierto: nombre === 'Caja sin cerrar',
        vendedores: Array.from(
          new Set(pedidos.map((p) => p.vendedor.trim()).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b)),
        fecha: rangoFechas(pedidos.map(aPedido)),
        cuantos: pedidos.length,
        total: pedidos.reduce((s, p) => s + p.total, 0),
        cobrado: pedidos.filter((p) => p.pagado).reduce((s, p) => s + dineroDe(aPedido(p)), 0),
      }))
      .sort((a, b) => b.total - a.total);
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
        const variante = buscarVariante(l.promo);
        const clave = variante ? `${nombre} ${variante.nombre}` : nombre;
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

  const etiquetaArchivo =
    cierre !== 'todos' && cierre !== 'abierta'
      ? paraArchivo(cierre)
      : desde === hasta
        ? desde || 'todo'
        : `${desde || 'inicio'}_${hasta || 'hoy'}`;

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
        <select
          value={cierre}
          onChange={(e) => {
            setCierre(e.target.value);
            setPagina(1);
          }}
          aria-label="Cierre de caja"
          className={claseFecha}
        >
          <option value="todos">Todos los cierres</option>
          <option value="abierta">Caja sin cerrar</option>
          {cierres.map((c) => (
            <option key={c} value={c}>
              {c}
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
                <h2 className="mb-3 text-sm font-semibold">Por forma de pago</h2>
                <table className="w-full text-[13px]">
                  <thead className="text-[11px] uppercase tracking-wider text-bone-dim">
                    <tr>
                      <th className="pb-2 text-left font-medium">Forma</th>
                      <th className="pb-2 text-right font-medium">Pedidos</th>
                      <th className="pb-2 text-right font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porMetodo.map((a) => (
                      <tr key={a.metodo} className="border-t border-white/5">
                        <td className="py-2 font-medium">
                          {NOMBRE_METODO[a.metodo]}
                          {a.metodo === 'canje' && (
                            <span className="ml-1.5 text-[11px] text-bone-dim">(no es plata)</span>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums text-bone-dim">{a.pedidos}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {soles(a.monto)}
                        </td>
                      </tr>
                    ))}
                    {porMetodo.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 text-center text-bone-dim">
                          Nada cobrado todavía.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {descuadre !== 0 && (
                  <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
                    Faltan {soles(Math.abs(descuadre))} por repartir entre las formas de pago: hay
                    pedidos cobrados sin monto. Se arregla corriendo la migración 035.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-night-2 p-4">
                <h2 className="mb-3 text-sm font-semibold">Por cierre</h2>
                <table className="w-full text-[13px]">
                  <thead className="text-[11px] uppercase tracking-wider text-bone-dim">
                    <tr>
                      <th className="pb-2 text-left font-medium">Cierre</th>
                      <th className="pb-2 text-left font-medium">Fecha</th>
                      <th className="pb-2 text-left font-medium">Vendedor</th>
                      <th className="pb-2 text-right font-medium">Pedidos</th>
                      <th className="pb-2 text-right font-medium">Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCierre.map((c) => (
                      <tr key={c.nombre} className="border-t border-white/5">
                        <td className="py-2 font-medium">{c.nombre}</td>
                        <td className="py-2 text-bone-dim">{c.fecha}</td>
                        <td className="py-2">
                          {asignando === c.nombre ? (
                            <span className="flex items-center gap-1">
                              <input
                                value={nombreVendedor}
                                onChange={(e) => setNombreVendedor(e.target.value)}
                                onKeyDown={(e) =>
                                  e.key === 'Enter' && void guardarVendedorDelCierre(c.nombre)
                                }
                                placeholder="Nombre"
                                autoFocus
                                className="w-24 rounded-lg border border-white/20 bg-night px-2 py-1 text-[12px] outline-none focus:border-sugu"
                              />
                              <button
                                type="button"
                                disabled={guardando || !nombreVendedor.trim()}
                                onClick={() => void guardarVendedorDelCierre(c.nombre)}
                                className="grid h-7 w-7 place-items-center rounded-lg bg-sugu text-white disabled:opacity-40"
                                aria-label={`Guardar vendedor de ${c.nombre}`}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setAsignando(null)}
                                className="grid h-7 w-7 place-items-center rounded-lg border border-white/15 text-bone-dim"
                                aria-label="Cancelar"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <span className={c.vendedores.length ? '' : 'text-bone-dim'}>
                                {c.vendedores.join(', ') || '— sin nombre —'}
                              </span>
                              {/*
                                Solo en cierres ya hechos: sobre la caja abierta
                                manda el celular y lo pisaría al siguiente cambio.
                              */}
                              {!c.abierto && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAsignando(c.nombre);
                                    setNombreVendedor(c.vendedores[0] ?? '');
                                  }}
                                  className="grid h-6 w-6 place-items-center rounded-md border border-white/15 text-bone-dim"
                                  aria-label={`Poner vendedor a ${c.nombre}`}
                                >
                                  <UserRound className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums text-bone-dim">{c.cuantos}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {soles(c.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="rounded-2xl border border-white/10 bg-night-2 p-4">
                <h2 className="mb-3 text-sm font-semibold">Por vendedor</h2>
                <table className="w-full text-[13px]">
                  <thead className="text-[11px] uppercase tracking-wider text-bone-dim">
                    <tr>
                      <th className="pb-2 text-left font-medium">Vendedor</th>
                      <th className="pb-2 text-left font-medium">Cocina</th>
                      <th className="pb-2 text-right font-medium">Pedidos</th>
                      <th className="pb-2 text-right font-medium">Und</th>
                      <th className="pb-2 text-right font-medium">Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porVendedor.map(([nombre, f]) => (
                      <tr key={nombre} className="border-t border-white/5">
                        <td className="py-2 font-medium">{nombre}</td>
                        <td className="py-2">
                          {/* cada cajero tiene su enlace; nunca uno compartido */}
                          {claveCocina && nombre !== '— sin nombre —' ? (
                            <button
                              type="button"
                              onClick={() => void copiarCocina(nombre)}
                              className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 px-2 py-1 text-[12px] font-semibold text-sky-300"
                            >
                              {copiado === nombre ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <ChefHat className="h-3 w-3" />
                              )}
                              {copiado === nombre ? 'Copiado' : 'Copiar enlace'}
                            </button>
                          ) : (
                            <span className="text-bone-dim">—</span>
                          )}
                        </td>
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
                          {(p.nota ?? '').trim() && (
                            <p className="mt-0.5 text-[12px] font-semibold text-amber-300">
                              {p.nota}
                            </p>
                          )}
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
                              {p.metodo === 'mixto'
                                ? `Yape ${soles(p.monto_yape)} · Efec. ${soles(p.monto_efectivo)}`
                                : (NOMBRE_METODO[p.metodo] ?? p.metodo)}
                            </span>
                            {p.entregado && (
                              <span className="rounded-full bg-sky-600/20 px-2 py-0.5 font-semibold text-sky-400">
                                Entregado
                              </span>
                            )}
                            <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-bone-dim">
                              {(p.cierre ?? '').trim() || 'Caja sin cerrar'}
                            </span>
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
