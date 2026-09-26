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
  /**
   * Cuándo se tocó "Entregar", en la hora del equipo. Con `creado` da el
   * tiempo de atención. Vacío si nunca se entregó a mano: lo que se da por
   * entregado al cerrar la caja no tiene hora real y no entra en el promedio.
   */
  entregadoEn: string | null;
};

/* El maki va primero: es lo que más se vende y no debe costar un toque extra. */
export const PRODUCTOS: { id: ClaveProducto; nombre: string }[] = [
  { id: 'maki', nombre: 'Maki' },
  { id: 'pokebowl', nombre: 'Poke Bowl' },
  { id: 'onigiri', nombre: 'Onigiri' },
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
 *
 * `precio` es el de CARTA. El que se cobra puede ser otro: el panel pone
 * precios propios por caja (ver `Precios`), así que para cobrar se usa
 * siempre `precioUnitario` con los precios vigentes, nunca este número.
 */
export type Variante = {
  id: string;
  nombre: string;
  precio: number;
  maxSabores: number;
  /** lo que va bajo el precio en el botón: "1 sabor", "1 o 2 sabores" */
  detalle?: string;
};

export const VARIANTES: Record<ClaveProducto, Variante[]> = {
  maki: [
    { id: 'cinco', nombre: '5 piezas', precio: 15, maxSabores: 1, detalle: '1 sabor' },
    { id: 'personal', nombre: 'Personal', precio: 20, maxSabores: 1, detalle: '1 sabor' },
    { id: 'duo', nombre: 'Dúo', precio: 35, maxSabores: 2, detalle: '1 o 2 sabores' },
  ],
  pokebowl: [
    { id: 'pollo', nombre: 'Pollo', precio: 18, maxSabores: 0 },
    { id: 'tartar', nombre: 'Tartar de pescado', precio: 18, maxSabores: 0 },
    { id: 'tofu', nombre: 'Tofu', precio: 18, maxSabores: 0 },
    { id: 'langostino', nombre: 'Langostino', precio: 20, maxSabores: 0 },
  ],
  // el onigiri se vende tal cual: no hay variante que elegir
  onigiri: [],
};

/** Precio de carta de los productos que no tienen variante. */
const PRECIO_SIMPLE: Record<ClaveProducto, number> = { maki: 0, pokebowl: 0, onigiri: 6 };

/**
 * Precios vigentes, por clave: el id de la variante ('duo', 'pollo'…) o el
 * del producto cuando no tiene variantes ('onigiri'). Los ids de variante
 * no se repiten entre productos, así que una sola tabla alcanza.
 */
export type Precios = Record<string, number>;

/** Clave de precio de una línea: su variante, o el producto si no tiene. */
export const clavePrecio = (producto: ClaveProducto, variante: string | null) =>
  variantesDe(producto).length ? (variante ?? '') : producto;

/** Todo lo que se vende en la caja, en el orden de la carta. Es lo que edita el panel. */
export const MENU_CAJA: { clave: string; producto: ClaveProducto; nombre: string; carta: number }[] =
  PRODUCTOS.flatMap((p) =>
    VARIANTES[p.id].length
      ? VARIANTES[p.id].map((v) => ({
          clave: v.id,
          producto: p.id,
          nombre: `${p.nombre} ${v.nombre}`,
          carta: v.precio,
        }))
      : [{ clave: p.id, producto: p.id, nombre: p.nombre, carta: PRECIO_SIMPLE[p.id] }],
  );

/** Los precios de carta: lo que rige mientras el panel no diga otra cosa. */
export const PRECIOS_CARTA: Precios = Object.fromEntries(MENU_CAJA.map((m) => [m.clave, m.carta]));

/**
 * Junta las capas de precio: carta, luego el base del panel, luego el de
 * esa caja. Solo cuenta un número positivo: un campo vacío hereda.
 */
export function combinarPrecios(...capas: (Precios | null | undefined)[]): Precios {
  const final: Precios = { ...PRECIOS_CARTA };
  for (const capa of capas) {
    for (const [clave, valor] of Object.entries(capa ?? {})) {
      if (clave in final && Number(valor) > 0) final[clave] = Number(valor);
    }
  }
  return final;
}

/** Clave de caja para los precios: el cajero, sin mayúsculas ni espacios de más. */
export const claveCaja = (vendedor: string) => vendedor.trim().toLowerCase();

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

export function precioUnitario(
  producto: ClaveProducto,
  variante: string | null,
  precios: Precios = PRECIOS_CARTA,
): number {
  if (variantesDe(producto).length && !variante) return 0;
  return precios[clavePrecio(producto, variante)] ?? 0;
}

const fmtPrecio = (n: number) => `S/ ${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** "S/ 18" o "S/ 15 – 35": lo que se muestra bajo el nombre del producto. */
export function rangoPrecio(producto: ClaveProducto, precios: Precios): string {
  const valores = MENU_CAJA.filter((m) => m.producto === producto).map((m) => precios[m.clave] ?? 0);
  const menor = Math.min(...valores);
  const mayor = Math.max(...valores);
  return menor === mayor ? fmtPrecio(menor) : `${fmtPrecio(menor)} – ${mayor}`;
}

/** Lo que va bajo una variante: su precio vigente y, si elige sabores, cuántos. */
export const pistaVariante = (producto: ClaveProducto, v: Variante, precios: Precios) =>
  [fmtPrecio(precioUnitario(producto, v.id, precios)), v.detalle].filter(Boolean).join(' · ');

/**
 * Pasa un pedido de unos precios a otros. Solo cambia las líneas que
 * estaban cobradas al precio anterior: si alguien retocó un precio a mano
 * en "Editar venta" —un descuento, una cortesía—, eso se respeta. Devuelve
 * el mismo objeto si no hubo nada que cambiar.
 */
export function repreciar(pedido: Pedido, antes: Precios, ahora: Precios): Pedido {
  let cambio = false;
  const lineas = pedido.lineas.map((l) => {
    const clave = clavePrecio(l.producto, l.promo);
    const viejo = antes[clave];
    const nuevo = ahora[clave];
    if (!nuevo || viejo === nuevo || l.unitario !== viejo) return l;
    cambio = true;
    return { ...l, unitario: nuevo, total: nuevo * l.cantidad };
  });
  if (!cambio) return pedido;
  const total = totalPedido(lineas);
  return { ...pedido, lineas, total, ...repartir(pedido.metodo, total, pedido.montoYape) };
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

/** Cuántos rolls es cada presentación de maki: el de 5 piezas es medio roll. */
const ROLLS_POR_PROMO: Record<string, number> = { cinco: 0.5, personal: 1, duo: 2 };

/**
 * Rolls de verdad que hay que preparar. Un maki Personal es uno, un Dúo
 * son dos y el de 5 piezas es medio, así que contar pedidos no sirve para
 * saber cuánto se corta: lo que importa en la tabla es el roll, no el ticket.
 */
export function rollsDe(lineas: Linea[]): number {
  return lineas
    .filter((l) => l.producto === 'maki')
    .reduce((s, l) => s + l.cantidad * (ROLLS_POR_PROMO[l.promo ?? ''] ?? 1), 0);
}

/** Unidades de un producto concreto: los contadores de la cabecera. */
export function unidadesDe(lineas: Linea[], producto: ClaveProducto): number {
  return lineas.filter((l) => l.producto === producto).reduce((s, l) => s + l.cantidad, 0);
}

/**
 * El siguiente correlativo de la caja abierta.
 *
 * Sale del mayor que haya en la lista, así que borrar el último devuelve su
 * número: si se anula el 003, el próximo vuelve a ser 003. Es lo que se
 * pidió para el mostrador —la numeración no deja huecos— a cambio de que un
 * número ya cantado pueda repetirse si se borra a destiempo.
 *
 * Es por CAJA: cada equipo cuenta sobre sus propios pedidos abiertos, de
 * modo que dos cajeros del mismo día tienen los dos su 001.
 */
export function siguienteNumero(abiertos: Pedido[]): number {
  return abiertos.reduce((mayor, p) => Math.max(mayor, p.numero ?? 0), 0) + 1;
}

/**
 * Aplica un cambio a un pedido sellando la hora de entrega: se pone al
 * pasar a entregado y se borra al devolverlo. Una corrección que no toca
 * la entrega conserva la hora que ya tenía.
 */
export function conEntrega(previo: Pedido, nuevo: Pedido): Pedido {
  if (!nuevo.entregado) return { ...nuevo, entregadoEn: null };
  if (previo.entregado) return { ...nuevo, entregadoEn: previo.entregadoEn ?? null };
  return { ...nuevo, entregadoEn: new Date().toISOString() };
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
    entregadoEn: previo.entregadoEn ?? null,
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

/*
 * Los precios vigentes de esta caja, tal como los mandó el panel la última
 * vez que hubo señal. Sin ellos se cobra a precio de carta; con ellos, una
 * feria sin conexión sigue cobrando lo que el panel decidió.
 */
const CLAVE_PRECIOS = 'sugu-caja-precios';

export function leerPrecios(): Precios {
  if (typeof window === 'undefined') return PRECIOS_CARTA;
  try {
    const crudo = window.localStorage.getItem(CLAVE_PRECIOS);
    return crudo ? combinarPrecios(JSON.parse(crudo) as Precios) : PRECIOS_CARTA;
  } catch {
    return PRECIOS_CARTA;
  }
}

export function guardarPrecios(precios: Precios): void {
  try {
    window.localStorage.setItem(CLAVE_PRECIOS, JSON.stringify(precios));
  } catch {
    /* sin almacenamiento los precios duran lo que dure la pestaña */
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
