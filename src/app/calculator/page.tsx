'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Archive,
  Banknote,
  ChefHat,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Copy,
  Download,
  LogOut,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  CreditCard,
  Gift,
  Smartphone,
  SquareSplitHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  METODOS_PAGO,
  NOMBRE_METODO,
  NOTAS_RAPIDAS,
  PRODUCTOS,
  SABORES,
  type ClaveProducto,
  type Linea,
  type MetodoPago,
  type Pedido,
  describirLinea,
  descargarExcel,
  dineroDe,
  espera,
  formatearNumero,
  guardarPedidos,
  guardarVendedor,
  hora,
  leerPedidos,
  leerVendedor,
  maxSabores,
  nuevoId,
  paraArchivo,
  precioUnitario,
  repartir,
  rollsDe,
  siguienteNumero,
  soles,
  totalPedido,
  unidadesDe,
  variantesDe,
} from '@/lib/caja';
import {
  cuantosPendientes,
  encolarNoSubidos,
  marcarBorrado,
  marcarSucio,
  sincronizar,
} from '@/lib/cajaSync';
import { cerrarSesion, esAdmin, traerClaveCocina, usuarioActual } from '@/lib/admin';
import { hayBackend } from '@/lib/contenido';
import { Login } from '@/components/admin/Login';

const POR_PAGINA = 20;

const ICONO_METODO: Record<MetodoPago, ReactNode> = {
  efectivo: <Banknote size={18} />,
  yape: <Smartphone size={18} />,
  mixto: <SquareSplitHorizontal size={18} />,
  tarjeta: <CreditCard size={18} />,
  canje: <Gift size={18} />,
};

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

function Ventana({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-end overflow-y-auto bg-black/70 p-4 sm:place-items-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-night-soft p-5">
        <h2 className="mb-3 text-lg font-bold">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Puerta                                                              */
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

  return <Caja sincroniza={acceso === 'listo'} />;
}

/* ------------------------------------------------------------------ */
/* Caja                                                                */
/* ------------------------------------------------------------------ */

/**
 * Caja de la feria. El ticket se arma por líneas —dos dúos con sabores
 * distintos son dos líneas de un mismo pedido— y la lista de abajo es el
 * control de la jornada: qué falta entregar y qué ya salió.
 */
function Caja({ sincroniza }: { sincroniza: boolean }) {
  // null mientras no se lee el navegador: evita pintar "0 pedidos" y corregir
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);

  // selección en curso
  const [producto, setProducto] = useState<ClaveProducto | null>(null);
  const [variante, setVariante] = useState<string | null>(null);
  const [sabores, setSabores] = useState<string[]>([]);
  const [cantidad, setCantidad] = useState(1);
  const [lineas, setLineas] = useState<Linea[]>([]);

  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  /*
   * Los dos montos del pago mitad y mitad se escriben por separado, pero uno
   * es el complemento del otro: al teclear en cualquiera de las dos cajas se
   * rellena la contraria. Se guardan como texto para que el campo que se
   * está tecleando conserve lo escrito —un "15." a medias no puede
   * convertirse en 15 y borrarle el punto a quien escribe—.
   */
  const [yapeParcial, setYapeParcial] = useState('');
  const [efectivoParcial, setEfectivoParcial] = useState('');
  const [pagado, setPagado] = useState(true);
  const [cliente, setCliente] = useState('');
  const [nota, setNota] = useState('');

  // quién abrió la caja
  const [vendedor, setVendedor] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState('');

  const [tab, setTab] = useState<'pendientes' | 'entregados'>('pendientes');
  const [pagina, setPagina] = useState(1);
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [editando, setEditando] = useState<Pedido | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [nombreCierre, setNombreCierre] = useState('');
  const [aviso, setAviso] = useState('');

  // cocina
  const [claveCocina, setClaveCocina] = useState('');
  const [origen, setOrigen] = useState('');
  const [mostrandoCocina, setMostrandoCocina] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // subida al panel
  const [pendientesSync, setPendientesSync] = useState(0);
  const [subiendo, setSubiendo] = useState(false);
  const [falloSync, setFalloSync] = useState<string | null>(null);

  /*
   * La carga y la subida NO dependen de que ya haya nombre: en un celular
   * sin migrar, abrir la caja tiene que empujar lo que quedó pendiente
   * aunque quien lo abra todavía no se haya identificado.
   */
  useEffect(() => {
    setOrigen(window.location.origin);
    setPedidos(leerPedidos());
    setVendedor(leerVendedor());
    encolarNoSubidos();
    setPendientesSync(cuantosPendientes());
  }, []);

  useEffect(() => {
    if (!sincroniza) return;
    void traerClaveCocina().then((clave) => {
      if (clave) setClaveCocina(clave);
    });
  }, [sincroniza]);

  /*
   * Cada cajero tiene su propia cocina: el enlace lleva su nombre y la
   * pantalla solo lista SUS pedidos. Si fuera uno solo para todos, dos
   * puestos mezclarían sus colas y quien cocina no sabría a cuál entregar.
   */
  const enlaceCocina =
    claveCocina && vendedor
      ? `${origen}/cocina?k=${claveCocina}&v=${encodeURIComponent(vendedor)}`
      : '';

  const empujar = useCallback(async () => {
    if (!sincroniza) return;
    setSubiendo(true);
    const r = await sincronizar();
    setSubiendo(false);
    setPendientesSync(r.pendientes);
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

  useEffect(() => {
    const alVolver = () => void empujar();
    window.addEventListener('online', alVolver);
    return () => window.removeEventListener('online', alVolver);
  }, [empujar]);

  // mientras quede cola, se reintenta sin que nadie tenga que tocar nada
  useEffect(() => {
    if (!pendientesSync || !sincroniza) return;
    const t = setInterval(() => void empujar(), 20000);
    return () => clearInterval(t);
  }, [pendientesSync, sincroniza, empujar]);

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

  /*
   * Reloj de un segundo para el tiempo de espera. Solo corre si hay algo
   * sin entregar: con la caja al día no tiene sentido repintar la pantalla
   * cada segundo y gastar batería en una feria.
   */
  const hayPendientes = (pedidos ?? []).some((p) => !p.cierre && !p.entregado);
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!hayPendientes) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hayPendientes]);

  const opciones = producto ? variantesDe(producto) : [];
  const tope = producto ? maxSabores(producto, variante) : 0;

  /** La selección en curso convertida en línea, o null si le falta algo. */
  const lineaActual = useMemo<Linea | null>(() => {
    if (!producto) return null;
    const exigeVariante = variantesDe(producto).length > 0;
    if (exigeVariante && !variante) return null;
    const cuantosSabores = maxSabores(producto, variante);
    if (cuantosSabores > 0 && sabores.length === 0) return null;
    const unitario = precioUnitario(producto, variante);
    if (unitario <= 0) return null;
    return {
      producto,
      promo: exigeVariante ? variante : null,
      sabores: cuantosSabores > 0 ? sabores : [],
      cantidad,
      unitario,
      total: unitario * cantidad,
    };
  }, [producto, variante, sabores, cantidad]);

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
  const puedeRegistrar = lineasFinales.length > 0;

  useEffect(() => {
    if (metodo !== 'mixto') return;
    // si cambia el total, el complemento deja de cuadrar: se vuelve a repartir
    setEfectivoParcial(String(repartir('mixto', totalActual, Number(yapeParcial)).montoEfectivo));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a propósito: no al teclear
  }, [totalActual, metodo]);


  /** Cobros del turno en curso: los que todavía no pertenecen a un cierre. */
  const abiertos = useMemo(() => (pedidos ?? []).filter((p) => !p.cierre), [pedidos]);

  const resumen = useMemo(() => {
    const total = abiertos.reduce((s, p) => s + p.total, 0);
    /*
     * Un canje se entrega pero no deja plata. Se saca de "cobrado" y se
     * informa aparte: si contara como cobrado, el arqueo del cierre pediría
     * un dinero que no está en el cajón.
     */
    const cobrado = abiertos.filter((p) => p.pagado).reduce((s, p) => s + dineroDe(p), 0);
    const canjeado = abiertos
      .filter((p) => p.pagado && p.metodo === 'canje')
      .reduce((s, p) => s + p.total, 0);
    const pendiente = abiertos.filter((p) => !p.pagado).reduce((s, p) => s + p.total, 0);
    const todasLasLineas = abiertos.flatMap((p) => p.lineas);
    return {
      total,
      cobrado,
      canjeado,
      pendiente,
      // en rolls, no en pedidos: un dúo son dos rolls que hay que cortar
      rolls: rollsDe(todasLasLineas),
      onigiris: unidadesDe(todasLasLineas, 'onigiri'),
      pokebowls: unidadesDe(todasLasLineas, 'pokebowl'),
    };
  }, [abiertos]);

  // descendente: el último cobro siempre arriba, que es el que se corrige
  const visibles = useMemo(
    () =>
      abiertos
        .filter((p) => (tab === 'pendientes' ? !p.entregado : p.entregado))
        .sort((a, b) => b.creado.localeCompare(a.creado)),
    [abiertos, tab],
  );

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const enPagina = visibles.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA);

  const soloNumero = (v: string) => v.replace(/[^\d.]/g, '');

  function ponerYape(v: string) {
    setYapeParcial(soloNumero(v));
    setEfectivoParcial(String(repartir('mixto', totalActual, Number(soloNumero(v))).montoEfectivo));
  }

  function ponerEfectivo(v: string) {
    setEfectivoParcial(soloNumero(v));
    // el yape es lo que falta para el total; repartir ya lo acota a [0, total]
    const efectivo = Math.min(Math.max(Number(soloNumero(v)) || 0, 0), totalActual);
    setYapeParcial(String(repartir('mixto', totalActual, totalActual - efectivo).montoYape));
  }

  function elegirProducto(id: ClaveProducto) {
    setProducto(id);
    // cada producto trae sus propias variantes y sabores; no se arrastran
    setVariante(null);
    setSabores([]);
  }

  function elegirVariante(id: string) {
    setVariante(id);
    // del dúo al personal sobra un sabor: se recorta al tope de la variante
    if (producto) setSabores((previos) => previos.slice(0, maxSabores(producto, id)));
  }

  function alternarSabor(sabor: string) {
    setSabores((previos) => {
      if (previos.includes(sabor)) return previos.filter((s) => s !== sabor);
      if (previos.length >= tope) return previos;
      return [...previos, sabor];
    });
  }

  function limpiarSeleccion() {
    setProducto(null);
    setVariante(null);
    setSabores([]);
    setCantidad(1);
  }

  function limpiarTodo() {
    limpiarSeleccion();
    setLineas([]);
    setMetodo('efectivo');
    setYapeParcial('');
    setEfectivoParcial('');
    setPagado(true);
    setCliente('');
    setNota('');
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
      numero: siguienteNumero(abiertos),
      creado: new Date().toISOString(),
      cliente: cliente.trim() || 'Cliente',
      vendedor: vendedor ?? '',
      cierre: '',
      nota: nota.trim(),
      lineas: lineasFinales,
      total: totalActual,
      metodo,
      ...repartir(metodo, totalActual, Number(yapeParcial)),
      pagado,
      entregado: false,
    };
    marcarSucio(nuevo.id);
    setPedidos((previos) => [...(previos ?? []), nuevo]);
    setTab('pendientes');
    setPagina(1);
    setAviso(`Registrado · ${soles(totalActual)}`);
    limpiarTodo();
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

  /** Guarda el pedido editado entero, con su total y su reparto recalculados. */
  function guardarEdicion(editado: Pedido) {
    const total = totalPedido(editado.lineas);
    const completo: Pedido = {
      ...editado,
      cliente: editado.cliente.trim() || 'Cliente',
      total,
      ...repartir(editado.metodo, total, editado.montoYape),
    };
    marcarSucio(completo.id);
    setPedidos((previos) => (previos ?? []).map((p) => (p.id === completo.id ? completo : p)));
    setEditando(null);
    setAviso('Venta corregida');
  }

  /**
   * Cierra el turno: sella con un nombre todos los cobros abiertos, baja el
   * Excel de esa jornada y deja la caja en cero para la siguiente. No borra
   * nada: lo cerrado sigue en el panel y en el historial del celular.
   */
  function cerrarCaja() {
    const nombre = nombreCierre.trim();
    if (!nombre || abiertos.length === 0) return;
    const cerrados = abiertos.map((p) => ({ ...p, cierre: nombre }));
    for (const p of abiertos) marcarSucio(p.id);
    setPedidos((previos) => (previos ?? []).map((p) => (p.cierre ? p : { ...p, cierre: nombre })));
    void descargarExcel(cerrados, paraArchivo(nombre));
    setCerrando(false);
    setNombreCierre('');
    setTab('pendientes');
    setPagina(1);
    setAviso(`Caja cerrada · ${nombre}`);
  }

  /* ---------------- Apertura: quién abre la caja ---------------- */

  if (pedidos === null) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-night">
        <p className="text-sm text-bone-dim">Abriendo la caja…</p>
      </div>
    );
  }

  if (!vendedor) {
    const abrir = () => {
      const nombre = nombreNuevo.trim();
      if (!nombre) return;
      guardarVendedor(nombre);
      setVendedor(nombre);
    };
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-night p-6 text-bone">
        <div className="w-full max-w-sm">
          <p className="text-center text-xl font-extrabold tracking-tight">
            Sugu<span className="text-sugu">Rolls</span>
          </p>
          <h1 className="mt-1 text-center text-[11px] uppercase tracking-widest text-bone-dim">
            Abrir caja
          </h1>
          <p className="mt-7 text-center text-sm text-bone-dim">
            ¿Quién va a atender en este equipo? Tu nombre queda en cada venta que registres.
          </p>
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Tu nombre"
            autoFocus
            enterKeyHint="go"
            onKeyDown={(e) => e.key === 'Enter' && abrir()}
            className="mt-5 w-full rounded-2xl border border-white/15 bg-night-2 px-4 py-4 text-center text-lg outline-none transition-colors placeholder:text-white/30 focus:border-sugu"
          />
          <button
            type="button"
            disabled={!nombreNuevo.trim()}
            onClick={abrir}
            className="mt-3 min-h-[58px] w-full rounded-2xl bg-sugu text-base font-bold text-white disabled:bg-night-3 disabled:text-bone-dim"
          >
            Ingresar
          </button>
          {abiertos.length > 0 && (
            <p className="mt-4 text-center text-[12px] text-bone-dim">
              Este equipo tiene {abiertos.length} pedidos sin cerrar por{' '}
              {soles(abiertos.reduce((s, p) => s + p.total, 0))}.
            </p>
          )}
        </div>
      </main>
    );
  }

  /* ---------------- Caja ---------------- */

  /*
   * Los pasos se numeran al pintar, no con números fijos: el onigiri no
   * elige variante ni sabores, y saltar del 1 al 4 se lee como si faltara
   * algo. Las claves se evalúan en orden, así que el contador va contando
   * solo los que de verdad se ven.
   */
  let n = 0;
  const paso = {
    producto: ++n,
    variante: opciones.length > 0 ? ++n : 0,
    sabores: tope > 0 ? ++n : 0,
    cantidad: ++n,
    pago: ++n,
    estado: ++n,
    cliente: ++n,
    nota: ++n,
  };
  const faltaVariante = Boolean(producto) && opciones.length > 0 && !variante;
  const faltaSabor = tope > 0 && sabores.length === 0;
  const faltante = !producto
    ? 'Elige un producto'
    : faltaVariante
      ? `Elige ${producto === 'maki' ? 'Personal o Dúo' : 'la base'}`
      : faltaSabor
        ? 'Elige el sabor'
        : '';

  const yapeMixto = metodo === 'mixto' ? repartir('mixto', totalActual, Number(yapeParcial)) : null;

  return (
    <main className="min-h-[100dvh] bg-night pb-10 text-bone">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-night/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-bone-dim">
                <span className="truncate">Caja abierta · {vendedor}</span>
                <button
                  type="button"
                  onClick={() => {
                    setNombreNuevo(vendedor);
                    setVendedor(null);
                  }}
                  className="text-bone-dim/70"
                  aria-label="Cambiar quién atiende"
                >
                  <Pencil size={11} />
                </button>
              </p>
              <p className="text-3xl font-bold leading-none text-sugu-glow sm:text-4xl">
                {soles(resumen.total)}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Etiqueta tono="verde">Cobrado {soles(resumen.cobrado)}</Etiqueta>
                <Etiqueta tono="ambar">Por cobrar {soles(resumen.pendiente)}</Etiqueta>
                {resumen.canjeado > 0 && (
                  <Etiqueta tono="azul">Canje {soles(resumen.canjeado)}</Etiqueta>
                )}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-bone-dim">
                Llevas atendiendo
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5">
                <Etiqueta tono="gris">Rolls: {resumen.rolls}</Etiqueta>
                <Etiqueta tono="gris">Onigiris: {resumen.onigiris}</Etiqueta>
                <Etiqueta tono="gris">Poke bowls: {resumen.pokebowls}</Etiqueta>
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              {enlaceCocina && (
                <button
                  type="button"
                  onClick={() => setMostrandoCocina(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-sky-500/50 bg-sky-500/15 px-3 py-2 text-[12px] font-semibold text-sky-300"
                >
                  <ChefHat size={14} />
                  Cocina
                </button>
              )}
              {/*
                El estado de la subida solo aparece cuando hay algo que
                mirar. Con todo al día no ocupa sitio en una pantalla que se
                usa con una mano y de pie.
              */}
              {sincroniza && (pendientesSync > 0 || falloSync) && (
                <button
                  type="button"
                  onClick={() => void empujar()}
                  title={falloSync ?? undefined}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/50 px-3 py-2 text-[12px] font-semibold text-amber-400"
                >
                  {subiendo ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <CloudOff size={13} />
                  )}
                  {subiendo ? 'Subiendo' : `${pendientesSync} sin subir`}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        {/* ---------------- Registro ---------------- */}
        <section className="grid gap-4 rounded-3xl border border-white/10 bg-night-soft p-4">
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

          {opciones.length > 0 && (
            <Paso n={paso.variante} titulo={producto === 'maki' ? 'Promoción' : 'Base'}>
              <div className={`grid gap-2 ${opciones.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {opciones.map((v) => (
                  <Opcion key={v.id} activo={variante === v.id} onClick={() => elegirVariante(v.id)}>
                    <span>{v.nombre}</span>
                    <span className="text-[10px] font-normal opacity-70">{v.pista}</span>
                  </Opcion>
                ))}
              </div>
            </Paso>
          )}

          {tope > 0 && (
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
              {variante === 'duo' && sabores.length === 1 && (
                <p className="mt-1.5 text-[11px] text-bone-dim">
                  El dúo vale S/ 35 con uno o con dos sabores.
                </p>
              )}
            </Paso>
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
            <div className="grid grid-cols-3 gap-2">
              {METODOS_PAGO.map((m) => (
                <Opcion key={m} activo={metodo === m} onClick={() => setMetodo(m)}>
                  {ICONO_METODO[m]}
                  <span className="text-[12px]">{NOMBRE_METODO[m]}</span>
                </Opcion>
              ))}
            </div>
            {metodo === 'canje' && (
              <p className="mt-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-[12px] text-sky-300">
                El canje se entrega pero no entra plata: no suma a lo cobrado del día.
              </p>
            )}
            {metodo === 'mixto' && yapeMixto && (
              <div className="mt-2 grid gap-2 rounded-2xl border border-white/10 bg-night-2 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] text-bone-dim">Yape</span>
                    <input
                      value={yapeParcial}
                      onChange={(e) => ponerYape(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full rounded-xl border border-white/15 bg-night px-3 py-2.5 text-base outline-none focus:border-sugu"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] text-bone-dim">Efectivo</span>
                    <input
                      value={efectivoParcial}
                      onChange={(e) => ponerEfectivo(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full rounded-xl border border-white/15 bg-night px-3 py-2.5 text-base outline-none focus:border-sugu"
                    />
                  </label>
                </div>
                <p className="text-[13px]">
                  Yape <span className="font-bold">{soles(yapeMixto.montoYape)}</span> + Efectivo{' '}
                  <span className="font-bold">{soles(yapeMixto.montoEfectivo)}</span> ={' '}
                  <span className="font-bold">{soles(totalActual)}</span>
                </p>
              </div>
            )}
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

          <Paso n={paso.nota} titulo="¿Algo aparte? (opcional)">
            {/* los atajos evitan escribir lo que se repite todo el día */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {NOTAS_RAPIDAS.map((texto) => {
                const puesta = nota.includes(texto);
                return (
                  <button
                    key={texto}
                    type="button"
                    onClick={() =>
                      setNota((previa) => {
                        if (previa.includes(texto)) {
                          return previa
                            .split(', ')
                            .filter((t) => t !== texto)
                            .join(', ');
                        }
                        return previa.trim() ? `${previa.trim()}, ${texto}` : texto;
                      })
                    }
                    className={`min-h-[36px] rounded-full border px-3 text-[12px] font-semibold transition-colors ${
                      puesta ? 'border-sugu bg-sugu text-white' : 'border-white/15 text-bone-dim'
                    }`}
                  >
                    {texto}
                  </button>
                );
              })}
            </div>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Sin palta, más queso, para llevar…"
              enterKeyHint="done"
              className="w-full rounded-2xl border border-white/15 bg-night px-4 py-3.5 text-base outline-none transition-colors placeholder:text-white/30 focus:border-sugu"
            />
            <p className="mt-1.5 text-[11px] text-bone-dim">Esto le llega a la cocina.</p>
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
          <div className="flex gap-1 rounded-xl border border-white/15 bg-night-2 p-1">
            {(['pendientes', 'entregados'] as const).map((t) => {
              const cuantos = abiertos.filter((p) =>
                t === 'pendientes' ? !p.entregado : p.entregado,
              ).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setPagina(1);
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                    tab === t ? 'bg-sugu text-white' : 'text-bone-dim'
                  }`}
                >
                  {t === 'pendientes' ? 'Por entregar' : 'Entregados'} ({cuantos})
                </button>
              );
            })}
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-sm text-bone-dim">
              {tab === 'pendientes'
                ? 'No queda nada por entregar.'
                : 'Todavía no has entregado ningún pedido.'}
            </p>
          ) : (
            <>
              <ul className="grid gap-2">
                {enPagina.map((p) => (
                  <li
                    key={p.id}
                    className={`rounded-2xl border bg-night-soft p-3 ${
                      p.entregado ? 'border-white/5 opacity-70' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-bone-dim">
                          <span className="font-bold text-bone">#{formatearNumero(p.numero)}</span>
                          <span>
                            {hora(p.creado)} · {p.cliente}
                          </span>
                          {/* lo que lleva esperando; una vez entregado ya da igual */}
                          {!p.entregado && (
                            <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-semibold tabular-nums">
                              {espera(p.creado, ahora)}
                            </span>
                          )}
                        </p>
                        {p.lineas.map((l, i) => (
                          <p key={i} className="mt-0.5 font-semibold">
                            {describirLinea(l)}
                          </p>
                        ))}
                        {p.nota && (
                          <p className="mt-1 text-[12px] font-semibold text-amber-300">
                            {p.nota}
                          </p>
                        )}
                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {p.pagado ? (
                            <Etiqueta tono="verde">Pagado</Etiqueta>
                          ) : (
                            <Etiqueta tono="ambar">Por cobrar</Etiqueta>
                          )}
                          <Etiqueta tono="gris">
                            {p.metodo === 'mixto'
                              ? `Yape ${soles(p.montoYape)} · Efec. ${soles(p.montoEfectivo)}`
                              : NOMBRE_METODO[p.metodo]}
                          </Etiqueta>
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
                        {p.entregado ? 'Devolver' : 'Entregar'}
                      </AccionFila>
                      <AccionFila icono={<Pencil size={15} />} onClick={() => setEditando(p)}>
                        Editar
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
            </>
          )}

          {abiertos.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => descargarExcel(abiertos, 'caja-abierta')}
                className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-600/15 font-semibold text-emerald-300 active:scale-[0.99]"
              >
                <Download size={18} />
                Descargar Excel ({abiertos.length})
              </button>
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
            </>
          )}
        </section>
      </div>

      {editando && (
        <EditarVenta
          pedido={editando}
          alGuardar={guardarEdicion}
          alCancelar={() => setEditando(null)}
        />
      )}

      {mostrandoCocina && (
        <Ventana titulo="Pantalla de cocina">
          <p className="text-sm text-bone-dim">
            Pásale este enlace a quien cocina. Verá los pedidos sin entregar, del más antiguo al
            más nuevo, y no necesita cuenta. No muestra precios ni cobros.
          </p>
          <p className="mt-3 break-all rounded-xl border border-white/10 bg-night px-3 py-2.5 text-[12px] text-bone-dim">
            {enlaceCocina}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMostrandoCocina(false)}
              className="min-h-[52px] rounded-2xl border border-white/15 font-semibold text-bone-dim"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(enlaceCocina);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 1800);
                } catch {
                  setCopiado(false);
                }
              }}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-sugu font-bold text-white"
            >
              {copiado ? <Check size={16} /> : <Copy size={16} />}
              {copiado ? 'Copiado' : 'Copiar enlace'}
            </button>
          </div>
        </Ventana>
      )}

      {cerrando && (
        <Ventana titulo="Cerrar caja">
          <p className="text-sm text-bone-dim">
            Se cierran {abiertos.length} pedidos por{' '}
            <span className="font-semibold text-bone">{soles(resumen.total)}</span>. Se descarga el
            Excel de este cierre y la caja vuelve a cero.
          </p>
          {resumen.pendiente > 0 && (
            <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
              Ojo: quedan {soles(resumen.pendiente)} sin cobrar. Se cierran igual, marcados como
              pendientes.
            </p>
          )}
          {sincroniza && pendientesSync > 0 && (
            <p className="mt-3 rounded-xl border border-white/15 px-3 py-2 text-[12px] text-bone-dim">
              Hay {pendientesSync} sin subir al panel. Se cierran igual y suben solos cuando vuelva
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
        </Ventana>
      )}

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

/* ------------------------------------------------------------------ */
/* Editar una venta ya registrada                                      */
/* ------------------------------------------------------------------ */

/**
 * Corrige un cobro entero: el nombre mal escrito, el medio de pago, el
 * reparto, si ya pagó, si ya salió, y las cantidades de cada línea. Trabaja
 * sobre una copia y solo devuelve el pedido al guardar, para que cancelar a
 * mitad no deje la venta a medias.
 */
function EditarVenta({
  pedido,
  alGuardar,
  alCancelar,
}: {
  pedido: Pedido;
  alGuardar: (p: Pedido) => void;
  alCancelar: () => void;
}) {
  const [copia, setCopia] = useState<Pedido>(pedido);
  const [yape, setYape] = useState(String(pedido.montoYape || ''));
  const [efectivo, setEfectivo] = useState(String(pedido.montoEfectivo || ''));
  /** índice de la línea abierta a fondo; null = ninguna */
  const [abierta, setAbierta] = useState<number | null>(null);

  const total = totalPedido(copia.lineas);
  const reparto = repartir(copia.metodo, total, Number(yape));

  const soloNumero = (v: string) => v.replace(/[^\d.]/g, '');

  /* Lo mismo que en el registro: al escribir en una caja se llena la otra. */
  function ponerYape(v: string) {
    setYape(soloNumero(v));
    setEfectivo(String(repartir('mixto', total, Number(soloNumero(v))).montoEfectivo));
  }

  function ponerEfectivo(v: string) {
    setEfectivo(soloNumero(v));
    const enEfectivo = Math.min(Math.max(Number(soloNumero(v)) || 0, 0), total);
    setYape(String(repartir('mixto', total, total - enEfectivo).montoYape));
  }

  /** Reemplaza una línea manteniendo su total coherente con precio y cantidad. */
  function cambiarLinea(i: number, cambios: Partial<Linea>) {
    setCopia((p) => ({
      ...p,
      lineas: p.lineas.map((l, j) => {
        if (j !== i) return l;
        const nueva = { ...l, ...cambios };
        return { ...nueva, total: nueva.unitario * nueva.cantidad };
      }),
    }));
  }

  /*
   * Cambiar de producto arrastra su variante y sus sabores: un onigiri no
   * puede quedarse con "Dúo" ni con los sabores del maki que era. El precio
   * vuelve al de la carta, y de ahí se puede retocar a mano.
   */
  function cambiarProducto(i: number, producto: ClaveProducto) {
    const opciones = variantesDe(producto);
    const variante = opciones.length ? opciones[0].id : null;
    cambiarLinea(i, {
      producto,
      promo: variante,
      sabores: [],
      unitario: precioUnitario(producto, variante),
    });
  }

  function cambiarVariante(i: number, l: Linea, variante: string) {
    cambiarLinea(i, {
      promo: variante,
      // del dúo al personal sobra un sabor: se recorta al tope de la variante
      sabores: l.sabores.slice(0, maxSabores(l.producto, variante)),
      unitario: precioUnitario(l.producto, variante),
    });
  }

  function alternarSaborLinea(i: number, l: Linea, sabor: string) {
    const tope = maxSabores(l.producto, l.promo);
    if (l.sabores.includes(sabor)) {
      cambiarLinea(i, { sabores: l.sabores.filter((x) => x !== sabor) });
    } else if (l.sabores.length < tope) {
      cambiarLinea(i, { sabores: [...l.sabores, sabor] });
    }
  }

  const cambiarCantidad = (i: number, delta: number) =>
    setCopia((p) => ({
      ...p,
      lineas: p.lineas.map((l, j) => {
        if (j !== i) return l;
        const cantidad = Math.max(1, l.cantidad + delta);
        return { ...l, cantidad, total: l.unitario * cantidad };
      }),
    }));

  return (
    <Ventana titulo="Editar venta">
      <div className="grid gap-4">
        <div className="grid gap-2 rounded-2xl border border-white/10 bg-night-2 p-3">
          {copia.lineas.map((l, i) => {
            const opciones = variantesDe(l.producto);
            const tope = maxSabores(l.producto, l.promo);
            return (
              <div
                key={i}
                className="grid gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  {/* tocar la línea abre su detalle: producto, sabores y precio */}
                  <button
                    type="button"
                    onClick={() => setAbierta(abierta === i ? null : i)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="underline decoration-white/25 underline-offset-4">
                      {describirLinea(l)}
                    </span>
                    <span className="ml-1.5 text-[12px] tabular-nums text-bone-dim">
                      {soles(l.total)}
                    </span>
                  </button>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(i, -1)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-white/15"
                      aria-label={`Quitar uno de ${describirLinea(l)}`}
                    >
                      <Minus size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(i, 1)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-white/15"
                      aria-label={`Agregar uno de ${describirLinea(l)}`}
                    >
                      <Plus size={13} />
                    </button>
                    {copia.lineas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAbierta(null);
                          setCopia((p) => ({ ...p, lineas: p.lineas.filter((_, j) => j !== i) }));
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-sugu/50 text-sugu-glow"
                        aria-label={`Quitar ${describirLinea(l)}`}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </span>
                </div>

                {/*
                  El detalle solo se despliega si hace falta: cambiar el
                  producto de una venta ya cobrada es la excepción, y tenerlo
                  siempre abierto alargaría la ventana sin motivo.
                */}
                {abierta === i && (
                  <div className="grid gap-2 rounded-xl border border-white/10 bg-night p-2.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      {PRODUCTOS.map((pr) => (
                        <Opcion
                          key={pr.id}
                          activo={l.producto === pr.id}
                          onClick={() => cambiarProducto(i, pr.id)}
                        >
                          <span className="text-[12px]">{pr.nombre}</span>
                        </Opcion>
                      ))}
                    </div>

                    {opciones.length > 0 && (
                      <div
                        className={`grid gap-1.5 ${
                          opciones.length > 2 ? 'grid-cols-3' : 'grid-cols-2'
                        }`}
                      >
                        {opciones.map((v) => (
                          <Opcion
                            key={v.id}
                            activo={l.promo === v.id}
                            onClick={() => cambiarVariante(i, l, v.id)}
                          >
                            <span className="text-[12px]">{v.nombre}</span>
                          </Opcion>
                        ))}
                      </div>
                    )}

                    {tope > 0 && (
                      <>
                        <p className="text-[11px] text-bone-dim">
                          Sabores · {l.sabores.length} de {tope}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {SABORES.map((sabor) => {
                            const elegido = l.sabores.includes(sabor);
                            return (
                              <Opcion
                                key={sabor}
                                activo={elegido}
                                disabled={!elegido && l.sabores.length >= tope}
                                onClick={() => alternarSaborLinea(i, l, sabor)}
                              >
                                <span className="text-[12px]">{sabor}</span>
                              </Opcion>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <label className="block">
                      <span className="mb-1 block text-[11px] text-bone-dim">
                        Precio por unidad
                      </span>
                      <input
                        value={String(l.unitario)}
                        onChange={(e) =>
                          cambiarLinea(i, { unitario: Number(soloNumero(e.target.value)) || 0 })
                        }
                        inputMode="decimal"
                        aria-label="Precio por unidad"
                        className="w-full rounded-lg border border-white/15 bg-night-2 px-3 py-2 text-base outline-none focus:border-sugu"
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          <p className="mt-1 text-right text-lg font-bold tabular-nums">{soles(total)}</p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Algo aparte</span>
          <input
            value={copia.nota}
            onChange={(e) => setCopia((p) => ({ ...p, nota: e.target.value }))}
            placeholder="Sin palta, más queso, para llevar…"
            className="w-full rounded-xl border border-white/15 bg-night px-3 py-2.5 text-base outline-none focus:border-sugu"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Cliente</span>
          <input
            value={copia.cliente}
            onChange={(e) => setCopia((p) => ({ ...p, cliente: e.target.value }))}
            placeholder="Cliente"
            className="w-full rounded-xl border border-white/15 bg-night px-3 py-2.5 text-base outline-none focus:border-sugu"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Forma de pago</span>
          <div className="grid grid-cols-3 gap-2">
            {METODOS_PAGO.map((m) => (
              <Opcion
                key={m}
                activo={copia.metodo === m}
                onClick={() => setCopia((p) => ({ ...p, metodo: m }))}
              >
                <span className="text-[12px]">{NOMBRE_METODO[m]}</span>
              </Opcion>
            ))}
          </div>
          {copia.metodo === 'mixto' && (
            <div className="mt-2 grid gap-2 rounded-xl border border-white/10 bg-night-2 p-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-bone-dim">Yape</span>
                  <input
                    value={yape}
                    onChange={(e) => ponerYape(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-white/15 bg-night px-3 py-2.5 text-base outline-none focus:border-sugu"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-bone-dim">Efectivo</span>
                  <input
                    value={efectivo}
                    onChange={(e) => ponerEfectivo(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-white/15 bg-night px-3 py-2.5 text-base outline-none focus:border-sugu"
                  />
                </label>
              </div>
              <p className="text-[13px]">
                Yape <span className="font-bold">{soles(reparto.montoYape)}</span> + Efectivo{' '}
                <span className="font-bold">{soles(reparto.montoEfectivo)}</span> ={' '}
                <span className="font-bold">{soles(total)}</span>
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Opcion
            activo={copia.pagado}
            onClick={() => setCopia((p) => ({ ...p, pagado: !p.pagado }))}
          >
            {copia.pagado ? 'Pagado' : 'Por cobrar'}
          </Opcion>
          <Opcion
            activo={copia.entregado}
            onClick={() => setCopia((p) => ({ ...p, entregado: !p.entregado }))}
          >
            {copia.entregado ? 'Entregado' : 'Sin entregar'}
          </Opcion>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={alCancelar}
            className="min-h-[52px] rounded-2xl border border-white/15 font-semibold text-bone-dim"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => alGuardar({ ...copia, montoYape: Number(yape) || 0 })}
            className="min-h-[52px] rounded-2xl bg-sugu font-bold text-white"
          >
            Guardar
          </button>
        </div>
      </div>
    </Ventana>
  );
}
