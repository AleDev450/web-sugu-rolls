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
 * feria no hay señal garantizada y un pedido perdido por un timeout es peor
 * que uno que no salió de la tablet. Por eso tampoco comparte tabla con
 * `orders` —esos son los pedidos de la web, con delivery y puntos— ni
 * necesita migración de Supabase para empezar a usarse.
 */

export type ClaveProducto = 'maki' | 'pokebowl' | 'onigiri';
export type PromoMaki = 'personal' | 'duo';
export type MetodoPago = 'efectivo' | 'yape';

/** Un renglón del ticket: un producto configurado, con su cantidad. */
export type Linea = {
  producto: ClaveProducto;
  /** Solo makis; en el resto va null. */
  promo: PromoMaki | null;
  sabores: string[];
  cantidad: number;
  unitario: number;
  total: number;
};

export type Pedido = {
  id: string;
  /** Fecha y hora exactas en que se tocó "Registrar". Es el sello del ticket. */
  creado: string;
  cliente: string;
  lineas: Linea[];
  total: number;
  metodo: MetodoPago;
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
 * Las dos promociones de maki. El precio lo pone la promo, NO cuántos
 * sabores se eligieron: un dúo de un solo sabor sigue costando 35.
 * `maxSabores` es el tope, no una obligación —el dúo vale con uno o con dos—,
 * pero al menos un sabor siempre hace falta.
 */
export const PROMOS_MAKI: {
  id: PromoMaki;
  nombre: string;
  precio: number;
  maxSabores: number;
  pista: string;
}[] = [
  { id: 'personal', nombre: 'Personal', precio: 20, maxSabores: 1, pista: 'S/ 20 · 1 sabor' },
  { id: 'duo', nombre: 'Dúo', precio: 35, maxSabores: 2, pista: 'S/ 35 · 1 o 2 sabores' },
];

export const NOMBRE_PROMO: Record<PromoMaki, string> = { personal: 'Personal', duo: 'Dúo' };

export const maxSabores = (promo: PromoMaki) =>
  PROMOS_MAKI.find((p) => p.id === promo)?.maxSabores ?? 1;

/** Los cuatro que se preparan en el puesto. Cambiar aquí cambia la pantalla. */
export const SABORES = ['Acevichado', 'California', 'Avocado', 'Hoto'];

const PRECIO_FIJO: Record<Exclude<ClaveProducto, 'maki'>, number> = {
  pokebowl: 18,
  onigiri: 6,
};

export function precioUnitario(producto: ClaveProducto, promo: PromoMaki | null): number {
  if (producto === 'maki') {
    if (!promo) return 0;
    return PROMOS_MAKI.find((p) => p.id === promo)?.precio ?? 0;
  }
  return PRECIO_FIJO[producto];
}

export const totalPedido = (lineas: Linea[]) => lineas.reduce((s, l) => s + l.total, 0);

export const unidades = (lineas: Linea[]) => lineas.reduce((s, l) => s + l.cantidad, 0);

/* ------------------------------------------------------------------ */
/* Guardado local                                                      */
/* ------------------------------------------------------------------ */

const CLAVE = 'sugu-caja-v1';

/** Forma anterior: un producto suelto por pedido, sin líneas ni promo. */
type PedidoGuardado = Partial<Pedido> & {
  producto?: ClaveProducto;
  sabores?: string[];
  cantidad?: number;
  unitario?: number;
};

/**
 * Lleva a la forma con líneas lo que se guardó antes de que existieran. Un
 * pedido viejo de maki se reconstruye por su precio —lo que valía 35 era un
 * dúo—, así que la caja de una feria en curso no se pierde al actualizar.
 */
function normalizar(guardado: PedidoGuardado): Pedido {
  const { producto, sabores, cantidad, unitario, ...resto } = guardado;

  if (Array.isArray(resto.lineas)) return resto as Pedido;

  const unidad = unitario ?? 0;
  const cuantos = cantidad ?? 1;
  const prod = producto ?? 'maki';
  const linea: Linea = {
    producto: prod,
    promo: prod === 'maki' ? (unidad >= 35 ? 'duo' : 'personal') : null,
    sabores: sabores ?? [],
    cantidad: cuantos,
    unitario: unidad,
    total: unidad * cuantos,
  };

  return { ...(resto as Pedido), lineas: [linea], total: resto.total ?? linea.total };
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

/** Nombre del producto con su promo: "Maki Dúo", "Onigiri". */
export function nombreLinea(l: Linea): string {
  const base = NOMBRE_PRODUCTO[l.producto];
  return l.promo ? `${base} ${NOMBRE_PROMO[l.promo]}` : base;
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
 * Exporta lo que se esté viendo en pantalla, una fila por línea: así se puede
 * filtrar por producto o por promo para ver qué salió más, y la columna de
 * total sigue sumando la venta exacta sin contar nada dos veces.
 *
 * `exceljs` se importa aquí dentro —no arriba— para que la librería no pese
 * en la carga de la caja: solo baja cuando de verdad se cierra el día.
 */
export async function descargarExcel(pedidos: Pedido[], etiqueta: string): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Caja');

  hoja.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Hora', key: 'hora', width: 8 },
    { header: 'Cliente', key: 'cliente', width: 22 },
    { header: 'Producto', key: 'producto', width: 12 },
    { header: 'Promoción', key: 'promo', width: 12 },
    { header: 'Sabores', key: 'sabores', width: 28 },
    { header: 'Cantidad', key: 'cantidad', width: 10 },
    { header: 'Precio unit.', key: 'unitario', width: 12 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Pago', key: 'metodo', width: 10 },
    { header: 'Cobrado', key: 'pagado', width: 10 },
    { header: 'Entregado', key: 'entregado', width: 11 },
  ];

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0263B' } };
  encabezado.alignment = { vertical: 'middle' };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  // del más antiguo al más nuevo: un cierre de caja se lee en orden de venta
  const ordenados = [...pedidos].sort((a, b) => a.creado.localeCompare(b.creado));

  for (const p of ordenados) {
    for (const l of p.lineas) {
      hoja.addRow({
        fecha: fechaCorta(p.creado),
        hora: hora(p.creado),
        cliente: p.cliente,
        producto: NOMBRE_PRODUCTO[l.producto],
        promo: l.promo ? NOMBRE_PROMO[l.promo] : '',
        sabores: l.sabores.join(', '),
        cantidad: l.cantidad,
        unitario: l.unitario,
        total: l.total,
        metodo: p.metodo === 'yape' ? 'Yape' : 'Efectivo',
        pagado: p.pagado ? 'Sí' : 'No',
        entregado: p.entregado ? 'Sí' : 'No',
      });
    }
  }

  for (const clave of ['unitario', 'total']) {
    hoja.getColumn(clave).numFmt = '"S/" #,##0.00';
  }

  const total = ordenados.reduce((s, p) => s + p.total, 0);
  const cobrado = ordenados.filter((p) => p.pagado).reduce((s, p) => s + p.total, 0);

  /*
   * Resumen al pie. Las etiquetas van en la columna del precio unitario, que
   * ya quedó con formato de moneda, así que a esas tres celdas se les fuerza
   * formato de texto para que Excel no las muestre como "S/ Cobrado".
   */
  hoja.addRow({});
  const filas = [
    hoja.addRow({ cliente: `${ordenados.length} pedidos`, unitario: 'Cobrado', total: cobrado }),
    hoja.addRow({ unitario: 'Por cobrar', total: total - cobrado }),
    hoja.addRow({ unitario: 'Venta total', total }),
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
