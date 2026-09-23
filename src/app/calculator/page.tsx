'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Archive,
  Banknote,
  Check,
  CloudCheck,
  CloudOff,
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  PackageCheck,
  Pencil,
  LogOut,
  Plus,
  RefreshCw,
  Smartphone,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {
  PRODUCTOS,
  PROMOS_MAKI,
  SABORES,
  type ClaveProducto,
  type Linea,
  type MetodoPago,
  type Pedido,
  type PromoMaki,
  describirLinea,
  descargarExcel,
  diaLocal,
  esDeHoy,
  fechaCorta,
  guardarPedidos,
  guardarVendedor,
  hora,
  leerPedidos,
  leerVendedor,
  maxSabores,
  nuevoId,
  paraArchivo,
  precioUnitario,
  soles,
  totalPedido,
  unidades,
} from '@/lib/caja';
import { cuantosPendientes, encolarNoSubidos, marcarBorrado, marcarSucio, sincronizar } from '@/lib/cajaSync';
import { cerrarSesion, esAdmin, usuarioActual } from '@/lib/admin';
import { hayBackend } from '@/lib/contenido';
import { Login } from '@/components/admin/Login';

const POR_PAGINA = 20;

/* Numeración de los pasos: el maki mete promo y sabores en el medio. */
const PASOS_MAKI = { producto: 1, promo: 2, sabores: 3, cantidad: 4, pago: 5, estado: 6, cliente: 7 };
const PASOS_SIMPLE = { producto: 1, promo: 0, sabores: 0, cantidad: 2, pago: 3, estado: 4, cliente: 5 };

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

function Paso({
  n,
  titulo,
  extra,
  children,
}: {
  n: number;
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
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

function Etiqueta({
  tono,
  children,
}: {
  tono: 'verde' | 'ambar' | 'azul' | 'gris';
  children: ReactNode;
}) {
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

/** Acción de una fila: icono y texto, un tercio del ancho de la tarjeta. */
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
      className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-center text-[12px] font-semibold leading-tight transition-colors active:scale-[0.98] ${estilos[tono]}`}
    >
      {icono}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Pantalla                                                            */
/* ------------------------------------------------------------------ */

type Acceso = 'cargando' | 'local' | 'anonimo' | 'sin-permiso' | 'listo';

/**
 * Puerta de la caja. Los cobros van a `caja_pedidos`, que es data de dinero:
 * exige la misma sesión que /admin, y RLS lo vuelve a comprobar del lado del
 * servidor. Sin Supabase configurado no hay a quién pedirle sesión, así que
 * la caja sigue funcionando en modo local —es preferible cobrar y que el
 * panel se entere luego, que no poder cobrar.
 */
export default function CajaPagina() {
  const [acceso, setAcceso] = useState<Acceso>('cargando');
  const [correo, setCorreo] = useState('');

  const revisar = useCallback(async () => {
    if (!hayBackend()) {
      setAcceso('local');
      return;
    }
    const usuario = await usuarioActual();
    if (!usuario) {
      setAcceso('anonimo');
      return;
    }
    setCorreo(usuario.email ?? '');
    const { admin } = await esAdmin();
    setAcceso(admin ? 'listo' : 'sin-permiso');
  }, []);

  useEffect(() => {
    void revisar();
  }, [revisar]);

  if (acceso === 'cargando') {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-night">
        <p className="text-sm text-bone-dim">Abriendo la caja…</p>
      </div>
    );
  }

  if (acceso === 'anonimo') return <Login alEntrar={() => void revisar()} />;

  if (acceso === 'sin-permiso') {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-night p-6 text-center">
        <div>
          <p className="font-semibold text-bone">Esta cuenta no tiene acceso a la caja.</p>
          <p className="mt-1 text-sm text-bone-dim">
            Entra con la cuenta de administrador de {correo ? `${correo}` : 'Sugu Rolls'}.
          </p>
          <button
            type="button"
            onClick={async () => {
              await cerrarSesion();
              void revisar();
            }}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-bone"
          >
            <LogOut size={16} />
            Cambiar de cuenta
          </button>
        </div>
      </div>
    );
  }

  return <Caja sincroniza={acceso === 'listo'} correo={correo} />;
}

/**
 * Caja de la feria. El ticket se arma por líneas —dos dúos con sabores
 * distintos son dos líneas de un mismo pedido— y la lista de abajo es el
 * control de lo vendido: quién falta pagar, qué falta entregar y cuánto va
 * en el día.
 */
function Caja({ sincroniza, correo }: { sincroniza: boolean; correo: string }) {
  // null mientras no se lee el navegador: evita pintar "0 pedidos" y corregir
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);

  // selección en curso
  const [producto, setProducto] = useState<ClaveProducto | null>(null);
  const [promo, setPromo] = useState<PromoMaki | null>(null);
  const [sabores, setSabores] = useState<string[]>([]);
  const [cantidad, setCantidad] = useState(1);

  // líneas ya apuntadas en el ticket abierto
  const [lineas, setLineas] = useState<Linea[]>([]);

  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [pagado, setPagado] = useState(true);
  const [cliente, setCliente] = useState('');

  const [vista, setVista] = useState<'abierta' | 'hoy' | 'todo'>('abierta');
  const [pagina, setPagina] = useState(1);
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  // quién atiende este turno, y el estado de la subida al panel
  const [vendedor, setVendedor] = useState('');
  const [editandoVendedor, setEditandoVendedor] = useState(false);
  const [borradorVendedor, setBorradorVendedor] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const [nombreCierre, setNombreCierre] = useState('');
  const [pendientes, setPendientes] = useState(0);
  const [subiendo, setSubiendo] = useState(false);
  const [falloSync, setFalloSync] = useState<string | null>(null);

  useEffect(() => {
    setPedidos(leerPedidos());
    // recupera lo cobrado sin señal y, la primera vez, la jornada ya guardada
    encolarNoSubidos();
    setPendientes(cuantosPendientes());
  }, []);

  /*
   * El nombre del turno arranca en el de la sesión: con una sola cuenta en la
   * tablet ya queda algo razonable escrito, y quien se turne lo cambia.
   */
  useEffect(() => {
    setVendedor(leerVendedor() || correo.split('@')[0] || '');
  }, [correo]);

  const empujar = useCallback(async () => {
    if (!sincroniza) return;
    setSubiendo(true);
    const r = await sincronizar();
    setSubiendo(false);
    setPendientes(r.pendientes);
    setFalloSync(r.error && r.error !== 'SIN_BACKEND' ? r.error : null);
  }, [sincroniza]);

  useEffect(() => {
    if (pedidos) guardarPedidos(pedidos);
  }, [pedidos]);

  /*
   * La subida cuelga de `pedidos` y NO de cada manejador: el efecto de
   * guardar está declarado justo arriba, así que cuando este corre el
   * localStorage ya tiene el cobro. Llamarlo desde el botón lo subiría antes
   * de haberlo escrito.
   */
  useEffect(() => {
    if (pedidos) void empujar();
  }, [pedidos, empujar]);

  // al volver la señal, lo pendiente sube solo
  useEffect(() => {
    const alVolver = () => void empujar();
    window.addEventListener('online', alVolver);
    return () => window.removeEventListener('online', alVolver);
  }, [empujar]);

  // mientras quede cola, se reintenta sin que nadie tenga que tocar nada
  useEffect(() => {
    if (!pendientes || !sincroniza) return;
    const t = setInterval(() => void empujar(), 30000);
    return () => clearInterval(t);
  }, [pendientes, sincroniza, empujar]);

  // el "¿Seguro?" no se queda armado: si no se confirma, vuelve solo
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

  const esMaki = producto === 'maki';
  const paso = esMaki ? PASOS_MAKI : PASOS_SIMPLE;
  const tope = promo ? maxSabores(promo) : 0;

  /**
   * La selección en curso convertida en línea, o null si todavía le falta
   * algo. Un maki necesita promo y al menos un sabor; el dúo vale igual con
   * uno que con dos.
   */
  const lineaActual = useMemo<Linea | null>(() => {
    if (!producto) return null;
    if (producto === 'maki' && (!promo || sabores.length === 0)) return null;
    const unitario = precioUnitario(producto, promo);
    if (unitario <= 0) return null;
    return {
      producto,
      promo: producto === 'maki' ? promo : null,
      sabores: producto === 'maki' ? sabores : [],
      cantidad,
      unitario,
      total: unitario * cantidad,
    };
  }, [producto, promo, sabores, cantidad]);

  /*
   * Lo que se registraría ahora mismo. La línea en curso entra sola, sin
   * pasar por "Agregar otro": el caso común —un solo producto— no debe
   * costar un toque de más.
   */
  const lineasFinales = useMemo(
    () => (lineaActual ? [...lineas, lineaActual] : lineas),
    [lineas, lineaActual],
  );
  const totalActual = totalPedido(lineasFinales);
  const puedeRegistrar = lineasFinales.length > 0 && vendedor.trim().length > 0;

  const visibles = useMemo(() => {
    const base = pedidos ?? [];
    const filtrados =
      vista === 'abierta'
        ? base.filter((p) => !p.cierre)
        : vista === 'hoy'
          ? base.filter((p) => esDeHoy(p.creado))
          : base;
    // descendente: el último cobro siempre arriba, que es el que se corrige
    return [...filtrados].sort((a, b) => b.creado.localeCompare(a.creado));
  }, [pedidos, vista]);

  const resumen = useMemo(() => {
    const total = visibles.reduce((s, p) => s + p.total, 0);
    const cobrado = visibles.filter((p) => p.pagado).reduce((s, p) => s + p.total, 0);
    const piezas = visibles.reduce((s, p) => s + unidades(p.lineas), 0);
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

  function elegirProducto(id: ClaveProducto) {
    setProducto(id);
    // promo y sabores son solo del maki; cambiar de producto no los arrastra
    if (id !== 'maki') {
      setPromo(null);
      setSabores([]);
    }
  }

  function elegirPromo(id: PromoMaki) {
    setPromo(id);
    // del dúo al personal sobra un sabor: se recorta al tope de la promo
    setSabores((previos) => previos.slice(0, maxSabores(id)));
  }

  function alternarSabor(sabor: string) {
    setSabores((previos) => {
      if (previos.includes(sabor)) return previos.filter((s) => s !== sabor);
      if (previos.length >= tope) return previos;
      return [...previos, sabor];
    });
  }

  /** Deja la selección en blanco; el ticket abierto no se toca. */
  function limpiarSeleccion() {
    setProducto(null);
    setPromo(null);
    setSabores([]);
    setCantidad(1);
  }

  function limpiarTodo() {
    limpiarSeleccion();
    setLineas([]);
    setMetodo('efectivo');
    setPagado(true);
    setCliente('');
  }

  function agregarLinea() {
    if (!lineaActual) return;
    setLineas((previas) => [...previas, lineaActual]);
    limpiarSeleccion();
  }

  function registrar() {
    if (lineasFinales.length === 0) return;
    const nuevo: Pedido = {
      id: nuevoId(),
      creado: new Date().toISOString(),
      cliente: cliente.trim() || 'Cliente',
      vendedor,
      cierre: '',
      lineas: lineasFinales,
      total: totalActual,
      metodo,
      pagado,
      entregado: false,
    };
    marcarSucio(nuevo.id);
    setPedidos((previos) => [...(previos ?? []), nuevo]);
    setVista('abierta');
    setPagina(1);
    setAviso(`Registrado · ${soles(totalActual)}`);
    limpiarTodo();
  }

  /** Cobros del turno en curso: los que todavía no pertenecen a un cierre. */
  const abiertos = useMemo(() => (pedidos ?? []).filter((p) => !p.cierre), [pedidos]);

  /**
   * Cierra el turno: sella con un nombre todos los cobros abiertos, baja el
   * Excel de esa jornada y deja la caja en cero para la siguiente. No borra
   * nada —lo cerrado sigue en "Todo" y en el panel—, solo lo saca de la
   * vista de trabajo.
   */
  function cerrarCaja() {
    const nombre = nombreCierre.trim();
    if (!nombre || abiertos.length === 0) return;

    const cerrados = abiertos.map((p) => ({ ...p, cierre: nombre }));
    // hay que volver a subirlos: el nombre del cierre viaja con cada cobro
    for (const p of abiertos) marcarSucio(p.id);
    setPedidos((previos) => (previos ?? []).map((p) => (p.cierre ? p : { ...p, cierre: nombre })));

    void descargarExcel(cerrados, paraArchivo(nombre));
    setCerrando(false);
    setNombreCierre('');
    setVista('abierta');
    setPagina(1);
    setAviso(`Caja cerrada · ${nombre}`);
  }

  function parchear(id: string, cambios: Partial<Pedido>) {
    marcarSucio(id);
    setPedidos((previos) => (previos ?? []).map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  }

  function eliminar(id: string) {
    marcarBorrado(id);
    setPedidos((previos) => (previos ?? []).filter((p) => p.id !== id));
    setPorBorrar(null);
  }

  /** Qué le falta a la selección, para que el botón grande lo diga. */
  function queFalta(): string {
    if (!vendedor.trim()) return 'Falta decir quién atiende';
    if (!producto) return 'Elige un producto';
    if (esMaki && !promo) return 'Elige Personal o Dúo';
    if (esMaki && sabores.length === 0) return 'Elige el sabor';
    return '';
  }
  const faltante = queFalta();

  return (
    <main className="min-h-[100dvh] bg-night pb-10 text-bone">
      {/* Acumulado siempre a la vista: es lo que se mira entre cliente y cliente */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-night/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-bone-dim">
              {vista === 'abierta'
                ? 'Caja abierta'
                : vista === 'hoy'
                  ? 'Venta de hoy'
                  : 'Venta acumulada'}
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
          <div className="flex flex-wrap items-center gap-2">
            {/* Quién atiende: se toca una vez por turno y viaja en cada cobro */}
            {editandoVendedor ? (
              <span className="flex items-center gap-1">
                <input
                  value={borradorVendedor}
                  onChange={(e) => setBorradorVendedor(e.target.value)}
                  placeholder="Tu nombre"
                  autoFocus
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const limpio = borradorVendedor.trim();
                      if (!limpio) return;
                      setVendedor(limpio);
                      guardarVendedor(limpio);
                      setEditandoVendedor(false);
                    }
                  }}
                  className="w-32 rounded-lg border border-white/20 bg-night px-2.5 py-1.5 text-[13px] outline-none focus:border-sugu"
                />
                <button
                  type="button"
                  onClick={() => {
                    const limpio = borradorVendedor.trim();
                    if (!limpio) return;
                    setVendedor(limpio);
                    guardarVendedor(limpio);
                    setEditandoVendedor(false);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-sugu text-white"
                  aria-label="Guardar quién atiende"
                >
                  <Check size={15} />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setBorradorVendedor(vendedor);
                  setEditandoVendedor(true);
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${
                  vendedor ? 'border-white/15 text-bone' : 'border-sugu text-sugu-glow'
                }`}
              >
                <UserRound size={13} />
                {vendedor || 'Quién atiende'}
              </button>
            )}

            {/* Estado de la subida al panel; sin backend ni se menciona */}
            {sincroniza && (
              <button
                type="button"
                onClick={() => void empujar()}
                title={falloSync ?? undefined}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${
                  falloSync || pendientes
                    ? 'border-amber-500/50 text-amber-400'
                    : 'border-emerald-500/40 text-emerald-400'
                }`}
              >
                {subiendo ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : falloSync || pendientes ? (
                  <CloudOff size={13} />
                ) : (
                  <CloudCheck size={13} />
                )}
                {subiendo ? 'Subiendo' : pendientes ? `${pendientes} sin subir` : 'En el panel'}
              </button>
            )}

            <div className="flex gap-1 rounded-xl border border-white/15 bg-night-2 p-1">
              {(['abierta', 'hoy', 'todo'] as const).map((v) => (
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
                  {v === 'abierta' ? 'Abierta' : v === 'hoy' ? 'Hoy' : 'Todo'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        {/* ---------------- Registro ---------------- */}
        <section className="grid gap-4 rounded-3xl border border-white/10 bg-night-soft p-4 lg:sticky lg:top-[7.5rem]">
          <Paso n={paso.producto} titulo="Producto">
            <div className="grid grid-cols-3 gap-2">
              {PRODUCTOS.map((p) => (
                <Opcion key={p.id} activo={producto === p.id} onClick={() => elegirProducto(p.id)}>
                  <span>{p.nombre}</span>
                  <span className="text-[10px] font-normal opacity-70">{p.pista}</span>
                </Opcion>
              ))}
            </div>
          </Paso>

          {esMaki && (
            <>
              <Paso n={paso.promo} titulo="Promoción">
                <div className="grid grid-cols-2 gap-2">
                  {PROMOS_MAKI.map((pr) => (
                    <Opcion key={pr.id} activo={promo === pr.id} onClick={() => elegirPromo(pr.id)}>
                      <span>{pr.nombre}</span>
                      <span className="text-[10px] font-normal opacity-70">{pr.pista}</span>
                    </Opcion>
                  ))}
                </div>
              </Paso>

              {promo && (
                <Paso
                  n={paso.sabores}
                  titulo="Sabores"
                  extra={
                    <span className="text-[12px] font-semibold text-bone-dim">
                      {sabores.length} de {tope}
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
                          // al llegar al tope el resto se apaga: el límite se ve, no se explica
                          disabled={!elegido && sabores.length >= tope}
                          onClick={() => alternarSabor(sabor)}
                        >
                          {sabor}
                        </Opcion>
                      );
                    })}
                  </div>
                  {promo === 'duo' && sabores.length === 1 && (
                    <p className="mt-1.5 text-[11px] text-bone-dim">
                      El dúo vale S/ 35 con uno o con dos sabores.
                    </p>
                  )}
                </Paso>
              )}
            </>
          )}

          <Paso n={paso.cantidad} titulo="Cantidad">
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
            <p className="mt-1.5 text-[11px] text-bone-dim">
              Para dos promos con sabores distintos, usa «Agregar otro».
            </p>
          </Paso>

          {/*
            El ticket abierto. Aparece recién cuando hay algo que sumar, para
            que el caso de siempre —un producto y a cobrar— no cargue con una
            caja vacía en pantalla.
          */}
          {lineasFinales.length > 0 && (
            <div className="grid gap-1.5 rounded-2xl border border-white/10 bg-night-2 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-bone-dim">Este pedido</p>
              {lineas.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1">{describirLinea(l)}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{soles(l.total)}</span>
                  <button
                    type="button"
                    onClick={() => setLineas((previas) => previas.filter((_, j) => j !== i))}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/15 text-bone-dim"
                    aria-label={`Quitar ${describirLinea(l)}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {lineaActual && (
                // la línea en curso se muestra en gris: todavía se puede cambiar
                <div className="flex items-center justify-between gap-2 text-sm text-bone-dim">
                  <span className="min-w-0 flex-1">{describirLinea(lineaActual)}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {soles(lineaActual.total)}
                  </span>
                  <span className="h-7 w-7 shrink-0" />
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={agregarLinea}
            disabled={!lineaActual}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-dashed border-white/25 text-[13px] font-semibold text-bone transition-colors active:scale-[0.99] disabled:opacity-30"
          >
            <Plus size={16} />
            Agregar otro al pedido
          </button>

          <Paso n={paso.pago} titulo="Forma de pago">
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

          <Paso n={paso.estado} titulo="¿Ya pagó?">
            <div className="grid grid-cols-2 gap-2">
              <Opcion activo={pagado} onClick={() => setPagado(true)}>
                Sí pagó
              </Opcion>
              <Opcion activo={!pagado} onClick={() => setPagado(false)}>
                No pagó
              </Opcion>
            </div>
          </Paso>

          <Paso n={paso.cliente} titulo="Cliente (opcional)">
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
              <span className="text-base">{puedeRegistrar ? 'Registrar pedido' : faltante}</span>
              <span className="text-2xl tabular-nums">{soles(totalActual)}</span>
            </button>
            <button
              type="button"
              onClick={limpiarTodo}
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
              {vista === 'abierta'
                ? 'La caja está en cero. El primer cobro aparece aquí.'
                : `Todavía no hay pedidos ${vista === 'hoy' ? 'hoy' : 'registrados'}.`}
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
                        {p.lineas.map((l, i) => (
                          <p key={i} className="mt-0.5 font-semibold">
                            {describirLinea(l)}
                          </p>
                        ))}
                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {p.pagado ? (
                            <Etiqueta tono="verde">Pagado</Etiqueta>
                          ) : (
                            <Etiqueta tono="ambar">Por cobrar</Etiqueta>
                          )}
                          <Etiqueta tono="gris">
                            {p.metodo === 'yape' ? 'Yape' : 'Efectivo'}
                          </Etiqueta>
                          {p.entregado && <Etiqueta tono="azul">Entregado</Etiqueta>}
                          {p.cierre && <Etiqueta tono="gris">{p.cierre}</Etiqueta>}
                        </p>
                      </div>
                      <span className="shrink-0 text-lg font-bold tabular-nums">
                        {soles(p.total)}
                      </span>
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
                  descargarExcel(
                    visibles,
                    vista === 'todo' ? 'historial' : diaLocal(new Date()),
                  )
                }
                className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-600/15 font-semibold text-emerald-300 active:scale-[0.99]"
              >
                <Download size={18} />
                Descargar Excel {vista === 'todo' ? 'de todo' : 'del día'} ({visibles.length})
              </button>

              {/* Cerrar solo tiene sentido si hay turno abierto que cerrar */}
              {abiertos.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setNombreCierre(`Caja ${new Date().toLocaleDateString('es-PE')}`);
                    setCerrando(true);
                  }}
                  className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-night-2 font-semibold text-bone active:scale-[0.99]"
                >
                  <Archive size={18} />
                  Cerrar caja ({abiertos.length})
                </button>
              )}
            </>
          )}
        </section>
      </div>

      {cerrando && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-black/70 p-4 sm:place-items-center">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-night-soft p-5">
            <h2 className="text-lg font-bold">Cerrar caja</h2>
            <p className="mt-1 text-sm text-bone-dim">
              Se cierran {abiertos.length} pedidos por{' '}
              <span className="font-semibold text-bone">
                {soles(abiertos.reduce((s, p) => s + p.total, 0))}
              </span>
              . Se descarga el Excel de este cierre y la caja vuelve a cero.
            </p>

            {abiertos.some((p) => !p.pagado) && (
              <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
                Ojo: quedan{' '}
                {soles(abiertos.filter((p) => !p.pagado).reduce((s, p) => s + p.total, 0))} sin
                cobrar. Se cierran igual, marcados como pendientes.
              </p>
            )}

            {sincroniza && pendientes > 0 && (
              <p className="mt-3 rounded-xl border border-white/15 px-3 py-2 text-[12px] text-bone-dim">
                Hay {pendientes} sin subir al panel. Se cierran igual y suben solos cuando vuelva
                la señal.
              </p>
            )}

            <label className="mt-4 block">
              <span className="mb-2 block text-[13px] font-medium">Nombre de este cierre</span>
              <input
                value={nombreCierre}
                onChange={(e) => setNombreCierre(e.target.value)}
                placeholder="Feria Pueblo Libre"
                enterKeyHint="done"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && cerrarCaja()}
                className="w-full rounded-2xl border border-white/15 bg-night px-4 py-3.5 text-base outline-none transition-colors placeholder:text-white/30 focus:border-sugu"
              />
            </label>
            <p className="mt-1.5 text-[11px] text-bone-dim">
              Con este nombre lo vas a encontrar después en el panel y en el Excel.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCerrando(false)}
                className="min-h-[52px] rounded-2xl border border-white/15 font-semibold text-bone-dim"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={cerrarCaja}
                disabled={!nombreCierre.trim()}
                className="min-h-[52px] rounded-2xl bg-sugu font-bold text-white disabled:bg-night-3 disabled:text-bone-dim"
              >
                Cerrar caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* confirmación breve del último cobro, sin tapar la lista */}
      {aviso && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-5 z-30 mx-auto w-fit rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-night shadow-lg"
        >
          {aviso}
        </div>
      )}
    </main>
  );
}
