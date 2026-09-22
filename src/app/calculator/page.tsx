'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {
  MAX_SABORES,
  NOMBRE_PRODUCTO,
  PRODUCTOS,
  SABORES,
  type ClaveProducto,
  type MetodoPago,
  type Pedido,
  describir,
  descargarExcel,
  diaLocal,
  esDeHoy,
  fechaCorta,
  guardarPedidos,
  hora,
  leerPedidos,
  nuevoId,
  precioUnitario,
  soles,
} from '@/lib/caja';

const POR_PAGINA = 20;

/* ------------------------------------------------------------------ */
/* Piezas de la caja                                                   */
/* ------------------------------------------------------------------ */

/**
 * Botón grande de opción. Todo en esta pantalla se toca, no se escribe: son
 * 58px de alto mínimo porque se usa de pie, con una mano y a veces con
 * guantes.
 */
function Opcion({
  activo,
  onClick,
  disabled,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={activo}
      className={`flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-3 text-center text-sm font-semibold leading-tight transition-colors active:scale-[0.98] ${
        activo
          ? 'border-sugu bg-sugu text-white'
          : 'border-white/15 bg-night-2 text-bone hover:border-white/30'
      } ${disabled ? 'opacity-30' : ''}`}
    >
      {children}
    </button>
  );
}

function Paso({ n, titulo, extra, children }: { n: number; titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-medium text-bone-dim">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-bone">
            {n}
          </span>
          {titulo}
        </span>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Etiqueta({ tono, children }: { tono: 'verde' | 'ambar' | 'azul' | 'gris'; children: ReactNode }) {
  const colores = {
    verde: 'bg-emerald-600/20 text-emerald-400',
    ambar: 'bg-amber-500/20 text-amber-400',
    azul: 'bg-sky-600/20 text-sky-400',
    gris: 'bg-white/10 text-bone-dim',
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${colores[tono]}`}>
      {children}
    </span>
  );
}

/** Acción de una fila: icono arriba, texto abajo, ancho completo de su tercio. */
function AccionFila({
  onClick,
  tono = 'neutro',
  icono,
  children,
}: {
  onClick: () => void;
  tono?: 'neutro' | 'peligro' | 'listo';
  icono: ReactNode;
  children: ReactNode;
}) {
  const estilos = {
    neutro: 'border-white/15 bg-night-3 text-bone hover:border-white/30',
    peligro: 'border-sugu/60 bg-sugu/15 text-sugu-glow',
    listo: 'border-sky-500/50 bg-sky-500/15 text-sky-300',
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-[12px] font-semibold transition-colors active:scale-[0.98] ${estilos[tono]}`}
    >
      {icono}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Pantalla                                                            */
/* ------------------------------------------------------------------ */

/**
 * Caja de la feria. Se registra de a un producto por ticket —así se cobra en
 * el puesto— y la lista de abajo es el control de lo vendido: quién falta
 * pagar, qué falta entregar y cuánto va en el día.
 */
export default function Caja() {
  // null mientras no se lee el navegador: evita pintar "0 pedidos" y corregir
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);

  const [producto, setProducto] = useState<ClaveProducto | null>(null);
  const [sabores, setSabores] = useState<string[]>([]);
  const [cantidad, setCantidad] = useState(1);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [pagado, setPagado] = useState(true);
  const [cliente, setCliente] = useState('');

  const [vista, setVista] = useState<'hoy' | 'todo'>('hoy');
  const [pagina, setPagina] = useState(1);
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => setPedidos(leerPedidos()), []);

  useEffect(() => {
    if (pedidos) guardarPedidos(pedidos);
  }, [pedidos]);

  // el "¿Borrar?" no se queda armado: si no se confirma, vuelve solo
  useEffect(() => {
    if (!porBorrar) return;
    const t = setTimeout(() => setPorBorrar(null), 4000);
    return () => clearTimeout(t);
  }, [porBorrar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 2200);
    return () => clearTimeout(t);
  }, [aviso]);

  const unitario = producto ? precioUnitario(producto, sabores) : 0;
  const totalActual = unitario * cantidad;
  const puedeRegistrar = Boolean(producto) && unitario > 0;

  const visibles = useMemo(() => {
    const base = pedidos ?? [];
    const filtrados = vista === 'hoy' ? base.filter((p) => esDeHoy(p.creado)) : base;
    // descendente: el último cobro siempre arriba, que es el que se corrige
    return [...filtrados].sort((a, b) => b.creado.localeCompare(a.creado));
  }, [pedidos, vista]);

  const resumen = useMemo(() => {
    const total = visibles.reduce((s, p) => s + p.total, 0);
    const cobrado = visibles.filter((p) => p.pagado).reduce((s, p) => s + p.total, 0);
    const piezas = visibles.reduce((s, p) => s + p.cantidad, 0);
    return { total, cobrado, pendiente: total - cobrado, piezas };
  }, [visibles]);

  /*
   * La página se acota al vuelo en vez de corregirse con un efecto: si se
   * borra el único pedido de la última página, el render de abajo ya usa una
   * página válida y no se ve un parpadeo en blanco.
   */
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const enPagina = visibles.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA);

  const alternarSabor = useCallback((sabor: string) => {
    setSabores((previos) => {
      if (previos.includes(sabor)) return previos.filter((s) => s !== sabor);
      if (previos.length >= MAX_SABORES) return previos;
      return [...previos, sabor];
    });
  }, []);

  function elegirProducto(id: ClaveProducto) {
    setProducto(id);
    // los sabores son solo del maki; cambiar de producto no debe arrastrarlos
    if (id !== 'maki') setSabores([]);
  }

  function limpiar() {
    setProducto(null);
    setSabores([]);
    setCantidad(1);
    setMetodo('efectivo');
    setPagado(true);
    setCliente('');
  }

  function registrar() {
    if (!producto || unitario <= 0) return;
    const nuevo: Pedido = {
      id: nuevoId(),
      creado: new Date().toISOString(),
      cliente: cliente.trim() || 'Cliente',
      producto,
      sabores,
      cantidad,
      unitario,
      total: totalActual,
      metodo,
      pagado,
      entregado: false,
    };
    setPedidos((previos) => [...(previos ?? []), nuevo]);
    setVista('hoy');
    setPagina(1);
    setAviso(`${NOMBRE_PRODUCTO[producto]} · ${soles(totalActual)}`);
    limpiar();
  }

  function parchear(id: string, cambios: Partial<Pedido>) {
    setPedidos((previos) => (previos ?? []).map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  }

  function eliminar(id: string) {
    setPedidos((previos) => (previos ?? []).filter((p) => p.id !== id));
    setPorBorrar(null);
  }

  return (
    <main className="min-h-[100dvh] bg-night pb-10 text-bone">
      {/* Acumulado siempre a la vista: es lo que se mira entre cliente y cliente */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-night/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-bone-dim">
              {vista === 'hoy' ? 'Venta de hoy' : 'Venta acumulada'}
            </p>
            <p className="text-3xl font-bold leading-none text-sugu-glow sm:text-4xl">
              {soles(resumen.total)}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <Etiqueta tono="verde">Cobrado {soles(resumen.cobrado)}</Etiqueta>
              <Etiqueta tono="ambar">Por cobrar {soles(resumen.pendiente)}</Etiqueta>
              <Etiqueta tono="gris">
                {visibles.length} pedidos · {resumen.piezas} und
              </Etiqueta>
            </p>
          </div>
          <div className="flex gap-1 rounded-xl border border-white/15 bg-night-2 p-1">
            {(['hoy', 'todo'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setVista(v);
                  setPagina(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  vista === v ? 'bg-sugu text-white' : 'text-bone-dim'
                }`}
              >
                {v === 'hoy' ? 'Hoy' : 'Todo'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        {/* ---------------- Registro ---------------- */}
        <section className="grid gap-4 rounded-3xl border border-white/10 bg-night-soft p-4 lg:sticky lg:top-[7.5rem]">
          <Paso n={1} titulo="Producto">
            <div className="grid grid-cols-3 gap-2">
              {PRODUCTOS.map((p) => (
                <Opcion key={p.id} activo={producto === p.id} onClick={() => elegirProducto(p.id)}>
                  <span>{p.nombre}</span>
                  <span className="text-[10px] font-normal opacity-70">{p.pista}</span>
                </Opcion>
              ))}
            </div>
          </Paso>

          {producto === 'maki' && (
            <Paso
              n={2}
              titulo="Sabores"
              extra={
                <span className="text-[12px] font-semibold text-bone-dim">
                  {sabores.length} de {MAX_SABORES}
                </span>
              }
            >
              <div className="grid grid-cols-2 gap-2">
                {SABORES.map((sabor) => {
                  const elegido = sabores.includes(sabor);
                  return (
                    <Opcion
                      key={sabor}
                      activo={elegido}
                      // con dos ya elegidos el resto se apaga: el límite se ve, no se explica
                      disabled={!elegido && sabores.length >= MAX_SABORES}
                      onClick={() => alternarSabor(sabor)}
                    >
                      {sabor}
                    </Opcion>
                  );
                })}
              </div>
            </Paso>
          )}

          <Paso n={producto === 'maki' ? 3 : 2} titulo="Cantidad">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                className="grid h-[58px] flex-1 place-items-center rounded-2xl border border-white/15 bg-night-2 active:scale-[0.98]"
                aria-label="Quitar uno"
              >
                <Minus size={20} />
              </button>
              <span className="min-w-[4rem] text-center text-3xl font-bold tabular-nums">
                {cantidad}
              </span>
              <button
                type="button"
                onClick={() => setCantidad((c) => Math.min(99, c + 1))}
                className="grid h-[58px] flex-1 place-items-center rounded-2xl border border-white/15 bg-night-2 active:scale-[0.98]"
                aria-label="Agregar uno"
              >
                <Plus size={20} />
              </button>
            </div>
          </Paso>

          <Paso n={producto === 'maki' ? 4 : 3} titulo="Forma de pago">
            <div className="grid grid-cols-2 gap-2">
              <Opcion activo={metodo === 'efectivo'} onClick={() => setMetodo('efectivo')}>
                <Banknote size={18} className="mb-0.5" />
                Efectivo
              </Opcion>
              <Opcion activo={metodo === 'yape'} onClick={() => setMetodo('yape')}>
                <Smartphone size={18} className="mb-0.5" />
                Yape
              </Opcion>
            </div>
          </Paso>

          <Paso n={producto === 'maki' ? 5 : 4} titulo="¿Ya pagó?">
            <div className="grid grid-cols-2 gap-2">
              <Opcion activo={pagado} onClick={() => setPagado(true)}>
                Sí pagó
              </Opcion>
              <Opcion activo={!pagado} onClick={() => setPagado(false)}>
                No pagó
              </Opcion>
            </div>
          </Paso>

          <Paso n={producto === 'maki' ? 6 : 5} titulo="Cliente (opcional)">
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Cliente"
              enterKeyHint="done"
              className="w-full rounded-2xl border border-white/15 bg-night px-4 py-3.5 text-base outline-none transition-colors placeholder:text-white/30 focus:border-sugu"
            />
            <p className="mt-1.5 text-[11px] text-bone-dim">
              Si lo dejas vacío se guarda como «Cliente».
            </p>
          </Paso>

          <div className="grid gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={registrar}
              disabled={!puedeRegistrar}
              className="flex min-h-[64px] items-center justify-between rounded-2xl bg-sugu px-5 text-left font-bold text-white transition-colors active:scale-[0.99] disabled:bg-night-3 disabled:text-bone-dim"
            >
              <span className="text-base">
                {puedeRegistrar
                  ? 'Registrar pedido'
                  : producto === 'maki'
                    ? 'Elige 1 o 2 sabores'
                    : 'Elige un producto'}
              </span>
              <span className="text-2xl tabular-nums">{soles(totalActual)}</span>
            </button>
            <button
              type="button"
              onClick={limpiar}
              className="min-h-[40px] rounded-xl border border-white/15 text-[13px] font-semibold text-bone-dim"
            >
              Limpiar
            </button>
          </div>
        </section>

        {/* ---------------- Lista ---------------- */}
        <section className="grid gap-3">
          {pedidos === null ? (
            <p className="rounded-3xl border border-white/10 bg-night-soft p-8 text-center text-sm text-bone-dim">
              Cargando caja…
            </p>
          ) : visibles.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-sm text-bone-dim">
              Todavía no hay pedidos {vista === 'hoy' ? 'hoy' : 'registrados'}.
            </p>
          ) : (
            <>
              <ul className="grid gap-2">
                {enPagina.map((p) => (
                  <li
                    key={p.id}
                    className={`rounded-2xl border bg-night-soft p-3 ${
                      p.entregado ? 'border-white/5 opacity-60' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] text-bone-dim">
                          {hora(p.creado)}
                          {vista === 'todo' && ` · ${fechaCorta(p.creado)}`} · {p.cliente}
                        </p>
                        <p className="mt-0.5 truncate font-semibold">{describir(p)}</p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {p.pagado ? (
                            <Etiqueta tono="verde">Pagado</Etiqueta>
                          ) : (
                            <Etiqueta tono="ambar">Por cobrar</Etiqueta>
                          )}
                          <Etiqueta tono="gris">{p.metodo === 'yape' ? 'Yape' : 'Efectivo'}</Etiqueta>
                          {p.entregado && <Etiqueta tono="azul">Entregado</Etiqueta>}
                        </p>
                      </div>
                      <span className="shrink-0 text-lg font-bold tabular-nums">{soles(p.total)}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <AccionFila
                        tono={p.entregado ? 'listo' : 'neutro'}
                        icono={<PackageCheck size={15} />}
                        onClick={() => parchear(p.id, { entregado: !p.entregado })}
                      >
                        {p.entregado ? 'Entregado' : 'Entregar'}
                      </AccionFila>
                      {/* "Editar" es exactamente esto: dar vuelta el cobro */}
                      <AccionFila
                        icono={p.pagado ? <Pencil size={15} /> : <Check size={15} />}
                        onClick={() => parchear(p.id, { pagado: !p.pagado })}
                      >
                        {p.pagado ? 'Anular pago' : 'Cobrar'}
                      </AccionFila>
                      <AccionFila
                        tono="peligro"
                        icono={<Trash2 size={15} />}
                        onClick={() => (porBorrar === p.id ? eliminar(p.id) : setPorBorrar(p.id))}
                      >
                        {porBorrar === p.id ? '¿Seguro?' : 'Eliminar'}
                      </AccionFila>
                    </div>
                  </li>
                ))}
              </ul>

              {totalPaginas > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPagina(paginaSegura - 1)}
                    disabled={paginaSegura === 1}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl border border-white/15 bg-night-2 text-[13px] font-semibold disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </button>
                  <span className="text-[12px] text-bone-dim">
                    {paginaSegura} / {totalPaginas}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPagina(paginaSegura + 1)}
                    disabled={paginaSegura === totalPaginas}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl border border-white/15 bg-night-2 text-[13px] font-semibold disabled:opacity-30"
                  >
                    Siguiente
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  descargarExcel(visibles, vista === 'hoy' ? diaLocal(new Date()) : 'historial')
                }
                className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-600/15 font-semibold text-emerald-300 active:scale-[0.99]"
              >
                <Download size={18} />
                Descargar Excel {vista === 'hoy' ? 'del día' : 'de todo'} ({visibles.length})
              </button>
            </>
          )}
        </section>
      </div>

      {/* confirmación breve del último cobro, sin tapar la lista */}
      {aviso && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-5 z-30 mx-auto w-fit rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-night shadow-lg"
        >
          Registrado · {aviso}
        </div>
      )}
    </main>
  );
}
