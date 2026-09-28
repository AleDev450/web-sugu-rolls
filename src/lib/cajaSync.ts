'use client';

import { getSupabase } from '@/lib/supabase/client';
import {
  type EstadoCocina,
  type Movimiento,
  type Pedido,
  type Precios,
  claveCaja,
  combinarPrecios,
  guardarMovimientos,
  guardarPedidos,
  leerMovimientos,
  leerPedidos,
} from '@/lib/caja';

/**
 * Los precios que el panel fijó para esta caja: el base y, encima, los de
 * este cajero. Devuelve null si no se pudo preguntar —sin señal, o una base
 * sin la migración 042—: entonces se sigue cobrando con lo que ya había.
 */
export async function traerPrecios(vendedor: string): Promise<Precios | null> {
  const sb = getSupabase();
  if (!sb || !vendedor.trim()) return null;
  const { data, error } = await sb
    .from('caja_precios')
    .select('caja, precios')
    .in('caja', ['', claveCaja(vendedor)]);
  if (error) return null;
  const filas = (data ?? []) as { caja: string; precios: Precios }[];
  return combinarPrecios(
    filas.find((f) => f.caja === '')?.precios,
    filas.find((f) => f.caja === claveCaja(vendedor))?.precios,
  );
}

/**
 * Sincronización de la caja de feria con Supabase.
 *
 * La tablet manda: lo que se cobra se guarda primero en `localStorage` y la
 * pantalla nunca espera a la red. Esto es lo que después empuja esa verdad a
 * `caja_pedidos` para que /admin/caja pueda verla. Si no hay señal, la venta
 * ya está hecha y se queda en cola; cuando vuelve la conexión, sube sola.
 *
 * El `id` de cada pedido lo generó la tablet, así que subir es un `upsert`
 * idempotente: reintentar tras un corte no duplica nada.
 */

type EstadoSync = {
  /** ids con cambios sin subir (altas y ediciones) */
  pendientes: string[];
  /** ids borrados en la tablet que hay que borrar también en la base */
  borrados: string[];
  /** ids que la base ya confirmó tener al día */
  confirmados: string[];
};

const CLAVE = 'sugu-caja-sync';
const VACIO: EstadoSync = { pendientes: [], borrados: [], confirmados: [] };

function leerEstado(): EstadoSync {
  if (typeof window === 'undefined') return VACIO;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return VACIO;
    const datos = JSON.parse(crudo) as Partial<EstadoSync>;
    return {
      pendientes: datos.pendientes ?? [],
      borrados: datos.borrados ?? [],
      confirmados: datos.confirmados ?? [],
    };
  } catch {
    return VACIO;
  }
}

function guardarEstado(estado: EstadoSync): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    /* sin almacenamiento la cola dura lo que dure la pestaña */
  }
}

const sinRepetir = (ids: string[]) => Array.from(new Set(ids));

/** Un pedido nuevo o editado: hay que volver a subirlo. */
export function marcarSucio(id: string): void {
  const e = leerEstado();
  guardarEstado({
    pendientes: sinRepetir([...e.pendientes, id]),
    borrados: e.borrados.filter((x) => x !== id),
    confirmados: e.confirmados.filter((x) => x !== id),
  });
}

/** Borrado en la tablet: si ya estaba arriba, hay que borrarlo allá también. */
export function marcarBorrado(id: string): void {
  const e = leerEstado();
  guardarEstado({
    pendientes: e.pendientes.filter((x) => x !== id),
    // si nunca llegó a subir, no hay nada que borrar en la base
    borrados: e.confirmados.includes(id) ? sinRepetir([...e.borrados, id]) : e.borrados,
    confirmados: e.confirmados.filter((x) => x !== id),
  });
}

/**
 * Pone en cola todo lo que la base todavía no confirmó. Se llama al abrir la
 * caja: recupera lo que se cobró sin señal y, la primera vez, sube de una la
 * jornada que ya estaba guardada en el equipo.
 */
export function encolarNoSubidos(): void {
  const e = leerEstado();
  const locales = leerPedidos().map((p) => p.id);
  const faltantes = locales.filter((id) => !e.confirmados.includes(id));
  guardarEstado({
    pendientes: sinRepetir([...e.pendientes, ...faltantes]),
    borrados: e.borrados,
    // poda: confirmados de pedidos que ya no existen en la tablet
    confirmados: e.confirmados.filter((id) => locales.includes(id)),
  });
}

export function cuantosPendientes(): number {
  const e = leerEstado();
  return e.pendientes.length + e.borrados.length;
}

/** El pedido tal como lo espera la tabla. `usuario_*` lo sella el servidor. */
function aFila(p: Pedido) {
  return {
    id: p.id,
    numero: p.numero ?? 0,
    creado: p.creado,
    cliente: p.cliente,
    vendedor: p.vendedor ?? '',
    cierre: p.cierre ?? '',
    nota: p.nota ?? '',
    lineas: p.lineas,
    total: p.total,
    metodo: p.metodo,
    monto_yape: p.montoYape ?? 0,
    monto_efectivo: p.montoEfectivo ?? 0,
    pagado: p.pagado,
    entregado: p.entregado,
    entregado_en: p.entregadoEn ?? null,
    vuelto_yape: p.vueltoYape ?? 0,
  };
}

/** Columnas que llegaron con migraciones posteriores a la tabla. */
const COLUMNAS_NUEVAS = ['entregado_en', 'vuelto_yape'];

export type Resultado = {
  subidos: number;
  borrados: number;
  pendientes: number;
  /** lo que el panel o la cocina cambiaron en cobros de esta caja */
  delServidor: Record<string, CambioServidor>;
  error: string | null;
};

/** Lo que otro escribió sobre un pedido de esta caja: el panel o la cocina. */
export type CambioServidor = Partial<
  Pick<Pedido, 'cierre' | 'entregado' | 'entregadoEn' | 'cocinaEstado' | 'cocinaEn'>
>;

type FilaBajada = {
  id: string;
  cierre: string;
  entregado_en?: string | null;
  cocina_estado?: string;
  cocina_en?: string | null;
};

/**
 * La bajada de la caja. Solo trae lo que escriben OTROS sobre los cobros
 * que aquí siguen abiertos:
 *
 *   · el cierre que el panel le puso a un día que quedó abierto;
 *   · lo que marcó la cocina: listo, o entregado directo al cliente.
 *
 * Se aplica al localStorage ANTES de subir la cola, así un cobro editado
 * que el panel ya cerró sube con su cierre y no con el vacío. Lo de la
 * cocina se salta en los pedidos con cambios sin subir: si el cajero acaba
 * de tocar "Devolver", su decisión manda y no se le vuelve a marcar
 * entregado encima. Sin señal no pasa nada: se reintenta en la siguiente
 * vuelta.
 */
async function bajarDelServidor(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
): Promise<Record<string, CambioServidor>> {
  const abiertos = leerPedidos()
    .filter((p) => !p.cierre)
    .map((p) => p.id);
  if (!abiertos.length) return {};

  const filas: FilaBajada[] = [];
  // en tandas: la lista de ids viaja en la URL de la consulta
  for (let i = 0; i < abiertos.length; i += 100) {
    const tanda = abiertos.slice(i, i + 100);
    const completa = await sb
      .from('caja_pedidos')
      .select('id, cierre, entregado_en, cocina_estado, cocina_en')
      .in('id', tanda);
    if (!completa.error) {
      filas.push(...((completa.data ?? []) as FilaBajada[]));
      continue;
    }
    // una base sin la 044 no tiene las columnas de cocina: solo los cierres
    const soloCierre = await sb.from('caja_pedidos').select('id, cierre').in('id', tanda);
    if (soloCierre.error) return {};
    filas.push(...((soloCierre.data ?? []) as FilaBajada[]));
  }

  // se relee: mientras se esperaba a la red pudo entrar un cobro nuevo
  const locales = new Map(leerPedidos().map((p) => [p.id, p]));
  const sucios = new Set(leerEstado().pendientes);
  const cambios: Record<string, CambioServidor> = {};

  for (const fila of filas) {
    const p = locales.get(fila.id);
    if (!p) continue;
    const cambio: CambioServidor = {};

    if (fila.cierre && !p.cierre) {
      cambio.cierre = fila.cierre;
      cambio.entregado = true;
    }

    if (fila.cocina_estado !== undefined && !sucios.has(p.id)) {
      const estado = (fila.cocina_estado ?? '') as EstadoCocina;
      const en = fila.cocina_en ?? null;
      if (estado !== p.cocinaEstado || en !== p.cocinaEn) {
        cambio.cocinaEstado = estado;
        cambio.cocinaEn = en;
      }
      if (estado === 'entregado' && !p.entregado) {
        cambio.entregado = true;
        cambio.entregadoEn = fila.entregado_en ?? en ?? new Date().toISOString();
        // se vuelve a subir: así `entregado` queda bien aunque una subida vieja lo hubiera pisado
        marcarSucio(p.id);
      }
    }

    if (Object.keys(cambio).length) cambios[p.id] = cambio;
  }
  if (!Object.keys(cambios).length) return {};

  guardarPedidos(leerPedidos().map((p) => (cambios[p.id] ? { ...p, ...cambios[p.id] } : p)));
  return cambios;
}

/**
 * El cajero devolvió un pedido que la cocina había entregado: se limpia lo
 * que marcó la cocina para que vuelva a su cola. Va aparte del upsert
 * porque la tablet nunca sube las columnas de cocina.
 */
export async function reiniciarCocina(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from('caja_pedidos').update({ cocina_estado: '', cocina_en: null }).eq('id', id);
}

/**
 * Empuja la cola. Devuelve el error en vez de lanzarlo: en plena feria una
 * caída de red no puede romper la pantalla, solo dejar el aviso de que hay
 * cobros sin subir.
 */
export async function sincronizar(): Promise<Resultado> {
  const sb = getSupabase();
  if (!sb) {
    return {
      subidos: 0,
      borrados: 0,
      pendientes: cuantosPendientes(),
      delServidor: {},
      error: 'SIN_BACKEND',
    };
  }

  const delServidor = await bajarDelServidor(sb);

  const inicial = leerEstado();
  if (!inicial.pendientes.length && !inicial.borrados.length) {
    return { subidos: 0, borrados: 0, pendientes: 0, delServidor, error: null };
  }

  const locales = new Map(leerPedidos().map((p) => [p.id, p]));
  /*
   * Se trabaja sobre una foto de la cola. Mientras se espera a la red se
   * pueden cobrar pedidos nuevos, y al terminar solo se descuenta lo que de
   * verdad entró en esta tanda: lo que llegó después queda para la siguiente.
   */
  const aSubir = inicial.pendientes.map((id) => locales.get(id)).filter(Boolean) as Pedido[];
  // un pendiente cuyo pedido ya no está en la tablet no tiene nada que subir
  const huerfanos = inicial.pendientes.filter((id) => !locales.has(id));
  const aBorrar = inicial.borrados;

  let subidos = 0;
  let borrados = 0;

  if (aSubir.length) {
    let { error } = await sb.from('caja_pedidos').upsert(aSubir.map(aFila));
    /*
     * Una base sin las migraciones 041/043 no conoce `entregado_en` ni
     * `vuelto_yape`. Se sube sin ellas antes que dejar la caja sin
     * sincronizar: el cobro es lo que no se puede perder.
     */
    if (COLUMNAS_NUEVAS.some((c) => error?.message.includes(c))) {
      ({ error } = await sb.from('caja_pedidos').upsert(
        aSubir.map((p) => {
          const fila: Record<string, unknown> = aFila(p);
          for (const c of COLUMNAS_NUEVAS) delete fila[c];
          return fila;
        }),
      ));
    }
    if (error) {
      return {
        subidos: 0,
        borrados: 0,
        pendientes: cuantosPendientes(),
        delServidor,
        error: error.message,
      };
    }
    subidos = aSubir.length;
  }

  if (aBorrar.length) {
    const { error } = await sb.from('caja_pedidos').delete().in('id', aBorrar);
    if (error) {
      // lo subido sí se confirma; el borrado se reintenta en la próxima vuelta
      const tras = leerEstado();
      guardarEstado({
        pendientes: tras.pendientes.filter((id) => !inicial.pendientes.includes(id)),
        borrados: tras.borrados,
        confirmados: sinRepetir([...tras.confirmados, ...aSubir.map((p) => p.id)]),
      });
      return {
        subidos,
        borrados: 0,
        pendientes: cuantosPendientes(),
        delServidor,
        error: error.message,
      };
    }
    borrados = aBorrar.length;
  }

  const tras = leerEstado();
  const hechos = [...inicial.pendientes];
  guardarEstado({
    pendientes: tras.pendientes.filter((id) => !hechos.includes(id)),
    borrados: tras.borrados.filter((id) => !aBorrar.includes(id)),
    confirmados: sinRepetir([...tras.confirmados, ...aSubir.map((p) => p.id)]).filter(
      (id) => !aBorrar.includes(id) && !huerfanos.includes(id),
    ),
  });

  return { subidos, borrados, pendientes: cuantosPendientes(), delServidor, error: null };
}

/* ------------------------------------------------------------------ */
/* Gastos y retiros                                                    */
/* ------------------------------------------------------------------ */

/*
 * Misma idea que los pedidos, en pequeño: cada gasto o retiro nace en la
 * tablet con su id, se guarda primero en el equipo y sube cuando hay señal.
 * Son pocos por jornada, así que la cola es solo "qué falta subir" y "qué
 * se borró".
 */
const CLAVE_MOV = 'sugu-caja-mov-sync';

type EstadoMov = { pendientes: string[]; borrados: string[] };

function leerEstadoMov(): EstadoMov {
  if (typeof window === 'undefined') return { pendientes: [], borrados: [] };
  try {
    const datos = JSON.parse(window.localStorage.getItem(CLAVE_MOV) ?? '{}') as Partial<EstadoMov>;
    return { pendientes: datos.pendientes ?? [], borrados: datos.borrados ?? [] };
  } catch {
    return { pendientes: [], borrados: [] };
  }
}

function guardarEstadoMov(estado: EstadoMov): void {
  try {
    window.localStorage.setItem(CLAVE_MOV, JSON.stringify(estado));
  } catch {
    /* sin almacenamiento la cola dura lo que dure la pestaña */
  }
}

export function marcarMovimientoSucio(id: string): void {
  const e = leerEstadoMov();
  guardarEstadoMov({
    pendientes: sinRepetir([...e.pendientes, id]),
    borrados: e.borrados.filter((x) => x !== id),
  });
}

export function marcarMovimientoBorrado(id: string): void {
  const e = leerEstadoMov();
  guardarEstadoMov({
    pendientes: e.pendientes.filter((x) => x !== id),
    borrados: sinRepetir([...e.borrados, id]),
  });
}

export function movimientosPendientes(): number {
  const e = leerEstadoMov();
  return e.pendientes.length + e.borrados.length;
}

export type ResultadoMov = {
  pendientes: number;
  /** id → cierre de los movimientos que el panel cerró al cerrar un día */
  cerradosEnPanel: Record<string, string>;
  error: string | null;
};

/**
 * Sube los gastos y retiros pendientes y trae el cierre de los que el panel
 * haya cerrado. Una base sin la migración 043 devuelve error y la cola
 * queda intacta: se reintenta sola cuando la tabla exista.
 */
export async function sincronizarMovimientos(): Promise<ResultadoMov> {
  const sb = getSupabase();
  if (!sb) return { pendientes: movimientosPendientes(), cerradosEnPanel: {}, error: 'SIN_BACKEND' };

  // bajada: cierres hechos desde el panel sobre movimientos que aquí siguen abiertos
  const cerradosEnPanel: Record<string, string> = {};
  const abiertos = leerMovimientos()
    .filter((m) => !m.cierre)
    .map((m) => m.id);
  if (abiertos.length) {
    const { data, error } = await sb
      .from('caja_movimientos')
      .select('id, cierre')
      .in('id', abiertos.slice(0, 200))
      .neq('cierre', '');
    if (!error) {
      for (const fila of data ?? []) cerradosEnPanel[fila.id as string] = fila.cierre as string;
      if (Object.keys(cerradosEnPanel).length) {
        guardarMovimientos(
          leerMovimientos().map((m) =>
            cerradosEnPanel[m.id] && !m.cierre ? { ...m, cierre: cerradosEnPanel[m.id] } : m,
          ),
        );
      }
    }
  }

  const inicial = leerEstadoMov();
  if (!inicial.pendientes.length && !inicial.borrados.length) {
    return { pendientes: 0, cerradosEnPanel, error: null };
  }

  const locales = new Map(leerMovimientos().map((m) => [m.id, m]));
  const aSubir = inicial.pendientes.map((id) => locales.get(id)).filter(Boolean) as Movimiento[];

  if (aSubir.length) {
    const { error } = await sb.from('caja_movimientos').upsert(aSubir);
    if (error) return { pendientes: movimientosPendientes(), cerradosEnPanel, error: error.message };
  }
  if (inicial.borrados.length) {
    const { error } = await sb.from('caja_movimientos').delete().in('id', inicial.borrados);
    if (error) {
      const tras = leerEstadoMov();
      guardarEstadoMov({
        pendientes: tras.pendientes.filter((id) => !inicial.pendientes.includes(id)),
        borrados: tras.borrados,
      });
      return { pendientes: movimientosPendientes(), cerradosEnPanel, error: error.message };
    }
  }

  // solo se descuenta lo de esta tanda: lo anotado mientras tanto queda para la próxima
  const tras = leerEstadoMov();
  guardarEstadoMov({
    pendientes: tras.pendientes.filter((id) => !inicial.pendientes.includes(id)),
    borrados: tras.borrados.filter((id) => !inicial.borrados.includes(id)),
  });
  return { pendientes: movimientosPendientes(), cerradosEnPanel, error: null };
}
