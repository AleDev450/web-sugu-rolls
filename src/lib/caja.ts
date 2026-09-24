/**
 * Caja de feria (/calculator).
 *
 * Es una caja registradora de mostrador, no el checkout de la web: se cobra
 * en persona y lo único que importa es que el registro tome pocos toques y
 * que al final del día cuadre la plata.
 *
 * Un pedido tiene LÍNEAS, no un solo producto, porque una persona puede
 * llevarse dos dúos con sabores distintos —uno de acevichado solo y otro de
 * acevichado con california— y eso no se puede escribir con una cantidad
 * sola: cada dúo elige sus propios sabores.
 *
 * Todo vive en el `localStorage` del equipo que atiende, a propósito: en una
 * feria no hay señal garantizada y un cobro perdido por un timeout es peor
 * que uno que no salió del celular. De ahí sale hacia `caja_pedidos` en
 * cuanto hay conexión, que es lo que leen el panel y la cocina.
 */

export type ClaveProducto = 'maki' | 'pokebowl' | 'onigiri';
export type MetodoPago = 'efectivo' | 'yape' | 'mixto' | 'tarjeta' | 'canje';

/** Un renglón del ticket: un producto configurado, con su cantidad. */
export type Linea = {
  producto: ClaveProducto;
  /**
   * La variante elegida: la promo del maki ('personal' | 'duo') o la base
   * del poke bowl ('pollo' | 'tartar' | 'tofu'). La clave se llama `promo`
   * porque así se guardó desde el primer día y hay celulares con cobros sin
   * migrar que la traen con ese nombre; renombrarla dejaría esos pedidos
   * sin poder leerse.
   */
  promo: string | null;
  sabores: string[];
  cantidad: number;
  unitario: number;
  total: number;
};

export type Pedido = {
  id: string;
  /**
   * Correlativo visible del pedido dentro de la caja abierta: 1, 2, 3… Se
   * reinicia en cada caja, así que dos cajeros del mismo día pueden tener
   * ambos un pedido 1 y no se pisan: lo que los distingue es el vendedor.
   * Es el número que se canta al entregar.
   */
  numero: number;
  /** Fecha y hora exactas en que se tocó "Registrar". Es el sello del ticket. */
  creado: string;
  cliente: string;
  /** Quién abrió la caja. Varias personas comparten cuenta, no nombre. */
  vendedor: string;
  /**
   * Nombre del cierre al que pertenece el cobro. Vacío = caja abierta, que
   * es lo que se ve mientras se atiende. Al cerrar se sella con el nombre
   * del turno y deja la caja en cero para la siguiente jornada.
   */
  cierre: string;
  /**
   * Lo que el cliente pidió aparte: "sin palta", "más queso", "para
   * llevar". Va en el pedido y no en la línea porque en el mostrador se
   * dice una vez, al final, y casi siempre vale para todo lo que lleva.
   */
  nota: string;
  lineas: Linea[];
  total: number;
  metodo: MetodoPago;
  /** Reparto del cobro. En un solo medio, uno lleva el total y el otro 0. */
  montoYape: number;
  montoEfectivo: number;
  pagado: boolean;
  entregado: boolean;
};

/* El maki va primero: es lo que más se vende y no debe costar un toque extra. */
export const PRODUCTOS: { id: ClaveProducto; nombre: string; pista: string }[] = [
  { id: 'maki', nombre: 'Maki', pista: 'Personal o Dúo' },
  { id: 'pokebowl', nombre: 'Poke Bowl', pista: 'S/ 18' },
  { id: 'onigiri', nombre: 'Onigiri', pista: 'S/ 6' },
];

export const NOMBRE_PRODUCTO: Record<ClaveProducto, string> = {
  maki: 'Maki',
  pokebowl: 'Poke Bowl',
  onigiri: 'Onigiri',
};

/**
 * Cómo se vende cada producto.
 *
 * El precio lo pone la VARIANTE, no cuántos sabores se eligieron: un dúo de
 * un solo sabor sigue costando 35. `maxSabores` es el tope, no una
 * obligación; en 0 significa que ese producto no elige sabores.
 */
export type Variante = {
  id: string;
  nombre: string;
  precio: number;
  maxSabores: number;
  pista: string;
};

export const VARIANTES: Record<ClaveProducto, Variante[]> = {
  maki: [
    { id: 'personal', nombre: 'Personal', precio: 20, maxSabores: 1, pista: 'S/ 20 · 1 sabor' },
    { id: 'duo', nombre: 'Dúo', precio: 35, maxSabores: 2, pista: 'S/ 35 · 1 o 2 sabores' },
  ],
  pokebowl: [
    { id: 'pollo', nombre: 'Pollo', precio: 18, maxSabores: 0, pista: 'S/ 18' },
    { id: 'tartar', nombre: 'Tartar de pescado', precio: 18, maxSabores: 0, pista: 'S/ 18' },
    { id: 'tofu', nombre: 'Tofu', precio: 18, maxSabores: 0, pista: 'S/ 18' },
  ],
  // el onigiri se vende tal cual: no hay variante que elegir
  onigiri: [],
};

/** Precio de los productos que no tienen variante. */
const PRECIO_SIMPLE: Record<ClaveProducto, number> = { maki: 0, pokebowl: 0, onigiri: 6 };

export function variantesDe(producto: ClaveProducto): Variante[] {
  return VARIANTES[producto] ?? [];
}

/** Busca una variante por id en cualquier producto; así se lee lo guardado. */
export function buscarVariante(id: string | null): Variante | undefined {
  if (!id) return undefined;
  for (const lista of Object.values(VARIANTES)) {
    const encontrada = lista.find((v) => v.id === id);
    if (encontrada) return encontrada;
  }
  return undefined;
}

export function precioUnitario(producto: ClaveProducto, variante: string | null): number {
  const opciones = variantesDe(producto);
  if (!opciones.length) return PRECIO_SIMPLE[producto];
  if (!variante) return 0;
  return opciones.find((v) => v.id === variante)?.precio ?? 0;
}

export function maxSabores(producto: ClaveProducto, variante: string | null): number {
  if (!variante) return 0;
  return variantesDe(producto).find((v) => v.id === variante)?.maxSabores ?? 0;
}

/** Notas de un toque: lo que más se pide y no hace falta escribir. */
export const NOTAS_RAPIDAS = ['Para llevar', 'Sin palta', 'Más queso', 'Sin ajonjolí', 'Sin picante'];

/** Los sabores de maki que se preparan en el puesto. */
export const SABORES = ['Acevichado', 'Avocado', 'California', 'Sugumi', 'Pizza', 'Vegano'];

export const totalPedido = (lineas: Linea[]) => lineas.reduce((s, l) => s + l.total, 0);

export const unidades = (lineas: Linea[]) => lineas.reduce((s, l) => s + l.cantidad, 0);

/** Unidades de un producto concreto: los contadores de la cabecera. */
export function unidadesDe(lineas: Linea[], producto: ClaveProducto): number {
  return lineas.filter((l) => l.producto === producto).reduce((s, l) => s + l.cantidad, 0);
}

/*
 * Último correlativo entregado en la caja abierta. Se guarda aparte de los
 * pedidos porque tiene que sobrevivir a que se borre uno: si el contador
 * saliera de la lista, eliminar el 003 haría que el siguiente volviera a
 * ser 003, y en el mostrador dos personas responderían al mismo número.
 * Saltarse un número no le hace daño a nadie; repetirlo sí.
 */
const CLAVE_NUMERO = 'sugu-caja-numero';

export function leerUltimoNumero(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return Number(window.localStorage.getItem(CLAVE_NUMERO)) || 0;
  } catch {
    return 0;
  }
}

export function guardarUltimoNumero(n: number): void {
  try {
    window.localStorage.setItem(CLAVE_NUMERO, String(n));
  } catch {
    /* sin almacenamiento el contador dura lo que dure la pestaña */
  }
}

/**
 * El siguiente correlativo de la caja abierta.
 *
 * Se mira el contador guardado Y el mayor de la lista, y se toma el más
 * alto: si el contador se perdiera —almacenamiento limpiado, caja traída
 * de otro equipo—, el número seguiría sin chocar con los que ya existen.
 */
export function siguienteNumero(abiertos: Pedido[], ultimo: number): number {
  const mayorEnLista = abiertos.reduce((mayor, p) => Math.max(mayor, p.numero ?? 0), 0);
  return Math.max(mayorEnLista, ultimo) + 1;
}

/** 1 -> "001". A partir de 1000 crece solo, sin recortar. */
export const formatearNumero = (n: number) => (n > 0 ? String(n).padStart(3, '0') : '—');

/**
 * Cuánto lleva esperando un pedido. Cuenta en segundos hasta el minuto y
 * de ahí pasa a minutos: en el primer minuto los segundos son la
 * información útil, y después estorban.
 */
export function espera(creado: string, ahora: number = Date.now()): string {
  const segundos = Math.max(0, Math.floor((ahora - Date.parse(creado)) / 1000));
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}

/** Céntimos exactos: evita que un reparto mitad y mitad arrastre decimales. */
const aCentimos = (n: number) => Math.round(n * 100) / 100;

/**
 * Reparto del cobro entre Yape y efectivo. En un solo medio no se pregunta
 * nada; en mixto manda lo que el cajero escribió como Yape y el resto es
 * efectivo, acotado para que nunca sume más que el total.
 */
export function repartir(
  metodo: MetodoPago,
  total: number,
  yapeIngresado: number,
): { montoYape: number; montoEfectivo: number } {
  if (metodo === 'yape') return { montoYape: aCentimos(total), montoEfectivo: 0 };
  if (metodo === 'efectivo') return { montoYape: 0, montoEfectivo: aCentimos(total) };
  // tarjeta y canje no pasan ni por el cajón ni por el Yape
  if (metodo === 'tarjeta' || metodo === 'canje') return { montoYape: 0, montoEfectivo: 0 };
  const yape = aCentimos(Math.min(Math.max(yapeIngresado || 0, 0), total));
  return { montoYape: yape, montoEfectivo: aCentimos(total - yape) };
}

/**
 * Plata que de verdad entró por este pedido. Un canje se sirve igual pero
 * no se cobra: su valor cuenta como regalado, nunca como cobrado, o el
 * arqueo del cierre pediría un dinero que no está.
 */
export const dineroDe = (p: Pick<Pedido, 'metodo' | 'total'>) =>
  p.metodo === 'canje' ? 0 : p.total;

export type ArqueoMetodo = { metodo: MetodoPago; monto: number; pedidos: number };

/**
 * Reparto de lo COBRADO por forma de pago, que es lo que se cuenta al
 * cerrar. Los pedidos sin pagar quedan fuera: todavía no son plata.
 *
 * Efectivo y Yape salen de los montos guardados —así un pago mitad y mitad
 * cae en las dos columnas—; tarjeta y canje, del total, porque no usan esos
 * campos.
 */
export function arqueoPorMetodo(pedidos: Pedido[]): ArqueoMetodo[] {
  const cobrados = pedidos.filter((p) => p.pagado);
  const fila = (metodo: MetodoPago, monto: number, pedidosDelMetodo: number) => ({
    metodo,
    monto: aCentimos(monto),
    pedidos: pedidosDelMetodo,
  });

  const cuantos = (m: MetodoPago) => cobrados.filter((p) => p.metodo === m).length;

  return [
    fila(
      'efectivo',
      cobrados.reduce((s, p) => s + p.montoEfectivo, 0),
      cuantos('efectivo') + cuantos('mixto'),
    ),
    fila(
      'yape',
      cobrados.reduce((s, p) => s + p.montoYape, 0),
      cuantos('yape') + cuantos('mixto'),
    ),
    fila(
      'tarjeta',
      cobrados.filter((p) => p.metodo === 'tarjeta').reduce((s, p) => s + p.total, 0),
      cuantos('tarjeta'),
    ),
    fila(
      'canje',
      cobrados.filter((p) => p.metodo === 'canje').reduce((s, p) => s + p.total, 0),
      cuantos('canje'),
    ),
  ].filter((f) => f.monto > 0 || f.pedidos > 0);
}

/** Rango de fechas que cubre un grupo de pedidos, para encabezar un resumen. */
export function rangoFechas(pedidos: Pedido[]): string {
  if (!pedidos.length) return '';
  const fechas = pedidos.map((p) => p.creado).sort();
  const desde = fechaCorta(fechas[0]);
  const hasta = fechaCorta(fechas[fechas.length - 1]);
  return desde === hasta ? desde : `${desde} al ${hasta}`;
}

/* ------------------------------------------------------------------ */
/* Guardado local                                                      */
/* ------------------------------------------------------------------ */

const CLAVE = 'sugu-caja-v1';

/** Forma anterior: un producto suelto por pedido, sin líneas ni variante. */
type PedidoGuardado = Partial<Pedido> & {
  producto?: ClaveProducto;
  sabores?: string[];
  cantidad?: number;
  unitario?: number;
};

/**
 * Lleva a la forma actual lo que se guardó con versiones anteriores. Hay
 * celulares con jornadas sin migrar, así que esto tiene que seguir
 * entendiendo el formato viejo: un pedido de maki se reconstruye por su
 * precio —lo que valía 35 era un dúo— y el reparto del cobro se deduce del
 * método, que entonces era uno solo.
 */
function normalizar(guardado: PedidoGuardado): Pedido {
  const { producto, sabores, cantidad, unitario, ...resto } = guardado;
  const previo = resto as Pedido;

  const lineas: Linea[] = Array.isArray(previo.lineas)
    ? previo.lineas
    : [
        {
          producto: producto ?? 'maki',
          promo:
            (producto ?? 'maki') === 'maki' ? ((unitario ?? 0) >= 35 ? 'duo' : 'personal') : null,
          sabores: sabores ?? [],
          cantidad: cantidad ?? 1,
          unitario: unitario ?? 0,
          total: (unitario ?? 0) * (cantidad ?? 1),
        },
      ];

  const total = previo.total ?? totalPedido(lineas);
  const metodo = previo.metodo ?? 'efectivo';
  const traeReparto =
    typeof previo.montoYape === 'number' && typeof previo.montoEfectivo === 'number';

  return {
    ...previo,
    numero: previo.numero ?? 0,
    vendedor: previo.vendedor ?? '',
    nota: previo.nota ?? '',
    cierre: previo.cierre ?? '',
    lineas,
    total,
    metodo,
    ...(traeReparto
      ? { montoYape: previo.montoYape, montoEfectivo: previo.montoEfectivo }
      : repartir(metodo, total, 0)),
  };
}

/**
 * Lee la caja guardada. Envuelto en try porque el navegador puede negar el
 * almacenamiento (modo incógnito, cookies bloqueadas) y una caja sin
 * historial todavía sirve para cobrar; una pantalla rota, no.
 */
export function leerPedidos(): Pedido[] {
  if (typeof window === 'undefined') return [];
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const datos = JSON.parse(crudo);
    return Array.isArray(datos) ? datos.map(normalizar) : [];
  } catch {
    return [];
  }
}

export function guardarPedidos(pedidos: Pedido[]): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(pedidos));
  } catch {
    /* sin almacenamiento la jornada sigue en memoria hasta recargar */
  }
}

/*
 * Quién abrió la caja. Se guarda aparte de los pedidos porque es del
 * EQUIPO, no de la venta: el celular lo recuerda entre recargas y quien
 * atiende no tiene que volver a escribir su nombre en media feria.
 */
const CLAVE_VENDEDOR = 'sugu-caja-vendedor';

export function leerVendedor(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(CLAVE_VENDEDOR) ?? '';
  } catch {
    return '';
  }
}

export function guardarVendedor(nombre: string): void {
  try {
    window.localStorage.setItem(CLAVE_VENDEDOR, nombre);
  } catch {
    /* sin almacenamiento el nombre dura lo que dure la pestaña */
  }
}

/** Nombre de cierre convertido en algo que el sistema de archivos acepte. */
export function paraArchivo(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'cierre'
  );
}

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ------------------------------------------------------------------ */
/* Formato                                                             */
/* ------------------------------------------------------------------ */

export const soles = (n: number) => `S/ ${n.toFixed(2)}`;

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

export const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-PE');

/** Clave YYYY-MM-DD en hora local, que es con la que razona quien atiende. */
export function diaLocal(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const mes = `${d.getMonth() + 1}`.padStart(2, '0');
  const dia = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export const esDeHoy = (iso: string) => diaLocal(iso) === diaLocal(new Date());

export const NOMBRE_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  yape: 'Yape',
  mixto: 'Mitad y mitad',
  tarjeta: 'Tarjeta',
  canje: 'Canje',
};

/** Orden en que se ofrecen en la caja, del más usado al menos. */
export const METODOS_PAGO: MetodoPago[] = ['efectivo', 'yape', 'mixto', 'tarjeta', 'canje'];

/** Nombre del producto con su variante: "Maki Dúo", "Poke Bowl Pollo". */
export function nombreLinea(l: Linea): string {
  const base = NOMBRE_PRODUCTO[l.producto] ?? l.producto;
  const variante = buscarVariante(l.promo);
  return variante ? `${base} ${variante.nombre}` : base;
}

/** Cómo se lee una línea: "2x Maki Dúo (Acevichado, California)". */
export function describirLinea(l: Linea): string {
  const base = `${l.cantidad}x ${nombreLinea(l)}`;
  return l.sabores.length ? `${base} (${l.sabores.join(', ')})` : base;
}

/* ------------------------------------------------------------------ */
/* Excel del cierre                                                    */
/* ------------------------------------------------------------------ */

/**
 * Exporta lo que se esté viendo, una fila por línea: así se puede filtrar
 * por producto o por variante para ver qué salió más, y la columna de total
 * sigue sumando la venta exacta sin contar nada dos veces.
 *
 * `exceljs` se importa aquí dentro —no arriba— para que la librería no pese
 * en la carga de la caja: solo baja cuando de verdad se cierra el día.
 */
export async function descargarExcel(pedidos: Pedido[], etiqueta: string): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Caja');

  hoja.columns = [
    { header: 'N°', key: 'numero', width: 7 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Hora', key: 'hora', width: 8 },
    { header: 'Vendedor', key: 'vendedor', width: 16 },
    { header: 'Cliente', key: 'cliente', width: 22 },
    { header: 'Nota', key: 'nota', width: 24 },
    { header: 'Producto', key: 'producto', width: 12 },
    { header: 'Variante', key: 'variante', width: 18 },
    { header: 'Sabores', key: 'sabores', width: 28 },
    { header: 'Cantidad', key: 'cantidad', width: 10 },
    { header: 'Precio unit.', key: 'unitario', width: 12 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Pago', key: 'metodo', width: 14 },
    { header: 'Yape', key: 'yape', width: 12 },
    { header: 'Efectivo', key: 'efectivo', width: 12 },
    { header: 'Cobrado', key: 'pagado', width: 10 },
    { header: 'Entregado', key: 'entregado', width: 11 },
    { header: 'Cierre', key: 'cierre', width: 20 },
  ];

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0263B' } };
  encabezado.alignment = { vertical: 'middle' };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  // del más antiguo al más nuevo: un cierre de caja se lee en orden de venta
  const ordenados = [...pedidos].sort((a, b) => a.creado.localeCompare(b.creado));

  for (const p of ordenados) {
    p.lineas.forEach((l, i) => {
      hoja.addRow({
        numero: formatearNumero(p.numero),
        fecha: fechaCorta(p.creado),
        hora: hora(p.creado),
        vendedor: p.vendedor,
        cliente: p.cliente,
        nota: p.nota,
        producto: NOMBRE_PRODUCTO[l.producto] ?? l.producto,
        variante: buscarVariante(l.promo)?.nombre ?? '',
        sabores: l.sabores.join(', '),
        cantidad: l.cantidad,
        unitario: l.unitario,
        total: l.total,
        metodo: NOMBRE_METODO[p.metodo] ?? p.metodo,
        /*
         * El reparto del cobro es del PEDIDO, no de la línea. Va solo en la
         * primera de cada pedido y en blanco en las demás: si se repitiera,
         * sumar la columna de efectivo daría más plata de la que hay.
         */
        yape: i === 0 ? p.montoYape : null,
        efectivo: i === 0 ? p.montoEfectivo : null,
        pagado: p.pagado ? 'Sí' : 'No',
        entregado: p.entregado ? 'Sí' : 'No',
        cierre: p.cierre,
      });
    });
  }

  for (const clave of ['unitario', 'total', 'yape', 'efectivo']) {
    hoja.getColumn(clave).numFmt = '"S/" #,##0.00';
  }

  const total = ordenados.reduce((s, p) => s + p.total, 0);
  const cobrados = ordenados.filter((p) => p.pagado);
  // el canje no es plata: su valor se informa aparte, nunca dentro de lo cobrado
  const cobrado = cobrados.reduce((s, p) => s + dineroDe(p), 0);
  const porCobrar = ordenados.filter((p) => !p.pagado).reduce((s, p) => s + p.total, 0);

  /*
   * Resumen al pie. Las etiquetas van en la columna del precio unitario, que
   * ya quedó con formato de moneda, así que a esas celdas se les fuerza
   * formato de texto para que Excel no las muestre como "S/ Cobrado".
   */
  hoja.addRow({});
  const filas = [
    // la fecha primero: un cierre suelto tiene que decir de cuándo es
    hoja.addRow({ cliente: 'Fecha', unitario: rangoFechas(ordenados) }),
    hoja.addRow({ cliente: `${ordenados.length} pedidos`, unitario: 'Cobrado', total: cobrado }),
    hoja.addRow({ unitario: 'Por cobrar', total: porCobrar }),
    hoja.addRow({ unitario: 'Venta total', total }),
    ...arqueoPorMetodo(ordenados).map((a) =>
      hoja.addRow({ unitario: `Cobrado en ${NOMBRE_METODO[a.metodo]}`, total: a.monto }),
    ),
  ];
  for (const fila of filas) {
    fila.font = { bold: true };
    fila.getCell('unitario').numFmt = '@';
  }

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `caja-sugu-${etiqueta}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
