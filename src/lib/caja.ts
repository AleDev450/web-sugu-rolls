/**
 * Caja de feria (/calculator).
 *
 * Es una caja registradora de mostrador, no el checkout de la web: se cobra
 * en persona, de a un producto por ticket, y lo único que importa es que el
 * registro tome dos toques y que al final del día cuadre la plata.
 *
 * Todo vive en el `localStorage` del equipo que atiende, a propósito: en una
 * feria no hay señal garantizada y un pedido perdido por un timeout es peor
 * que uno que no salió de la tablet. Por eso tampoco comparte tabla con
 * `orders` —esos son los pedidos de la web, con delivery y puntos— ni
 * necesita migración de Supabase para empezar a usarse.
 */

export type ClaveProducto = 'pokebowl' | 'onigiri' | 'maki';
export type MetodoPago = 'efectivo' | 'yape';

export type Pedido = {
  id: string;
  /** Fecha y hora exactas en que se tocó "Registrar". Es el sello del ticket. */
  creado: string;
  cliente: string;
  producto: ClaveProducto;
  /** Solo makis: 1 o 2 sabores. En el resto va vacío. */
  sabores: string[];
  cantidad: number;
  unitario: number;
  total: number;
  metodo: MetodoPago;
  pagado: boolean;
  entregado: boolean;
};

export const PRODUCTOS: { id: ClaveProducto; nombre: string; pista: string }[] = [
  { id: 'pokebowl', nombre: 'Poke Bowl', pista: 'S/ 18' },
  { id: 'onigiri', nombre: 'Onigiri', pista: 'S/ 6' },
  { id: 'maki', nombre: 'Maki', pista: '1 sabor S/ 20 · 2 sabores S/ 35' },
];

export const NOMBRE_PRODUCTO: Record<ClaveProducto, string> = {
  pokebowl: 'Poke Bowl',
  onigiri: 'Onigiri',
  maki: 'Maki',
};

/** Los cuatro que se preparan en el puesto. Cambiar aquí cambia la pantalla. */
export const SABORES = ['Acevichado', 'California', 'Avocado', 'Furai'];

export const MAX_SABORES = 2;

const PRECIO_FIJO: Record<Exclude<ClaveProducto, 'maki'>, number> = {
  pokebowl: 18,
  onigiri: 6,
};

/*
 * El maki no se cobra por unidad suelta sino por cuántos sabores lleva el
 * pedido: uno 20, dos 35. El índice del arreglo es el número de sabores
 * elegidos, así que la posición 0 —ningún sabor— vale 0 y con eso el botón
 * de registrar se queda bloqueado.
 */
const PRECIO_MAKI = [0, 20, 35];

export function precioUnitario(producto: ClaveProducto, sabores: string[]): number {
  if (producto === 'maki') return PRECIO_MAKI[sabores.length] ?? 0;
  return PRECIO_FIJO[producto];
}

/* ------------------------------------------------------------------ */
/* Guardado local                                                      */
/* ------------------------------------------------------------------ */

const CLAVE = 'sugu-caja-v1';

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
    return Array.isArray(datos) ? (datos as Pedido[]) : [];
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

/** Cómo se lee el pedido en una línea: "2x Maki (Acevichado, California)". */
export function describir(p: Pedido): string {
  const base = `${p.cantidad}x ${NOMBRE_PRODUCTO[p.producto]}`;
  return p.sabores.length ? `${base} (${p.sabores.join(', ')})` : base;
}

/* ------------------------------------------------------------------ */
/* Excel del cierre                                                    */
/* ------------------------------------------------------------------ */

/**
 * Exporta lo que se esté viendo en pantalla. `exceljs` se importa aquí dentro
 * —no arriba— para que la librería no pese en la carga de la caja: solo baja
 * cuando de verdad se cierra el día.
 */
export async function descargarExcel(pedidos: Pedido[], etiqueta: string): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Caja');

  hoja.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Hora', key: 'hora', width: 8 },
    { header: 'Cliente', key: 'cliente', width: 24 },
    { header: 'Producto', key: 'producto', width: 14 },
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
    hoja.addRow({
      fecha: fechaCorta(p.creado),
      hora: hora(p.creado),
      cliente: p.cliente,
      producto: NOMBRE_PRODUCTO[p.producto],
      sabores: p.sabores.join(', '),
      cantidad: p.cantidad,
      unitario: p.unitario,
      total: p.total,
      metodo: p.metodo === 'yape' ? 'Yape' : 'Efectivo',
      pagado: p.pagado ? 'Sí' : 'No',
      entregado: p.entregado ? 'Sí' : 'No',
    });
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
