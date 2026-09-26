'use client';

import { getSupabase } from '@/lib/supabase/client';
import { guardarPedidos, leerPedidos, type Pedido } from '@/lib/caja';

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
  };
}

export type Resultado = {
  subidos: number;
  borrados: number;
  pendientes: number;
  /** id → nombre del cierre, para los cobros que el panel cerró por su cuenta */
  cerradosEnPanel: Record<string, string>;
  error: string | null;
};

/**
 * La única bajada de la caja: el cierre que el panel le puso a un día que
 * quedó abierto (alguien se olvidó de cerrar). Solo se pregunta por los
 * cobros que aquí siguen abiertos, y solo se trae el nombre del cierre.
 *
 * Se aplica al localStorage ANTES de subir la cola, así un cobro editado
 * que el panel ya cerró sube con su cierre y no con el vacío. Sin señal no
 * pasa nada: se reintenta en la siguiente vuelta.
 */
async function bajarCierres(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
): Promise<Record<string, string>> {
  const abiertos = leerPedidos()
    .filter((p) => !p.cierre)
    .map((p) => p.id);
  if (!abiertos.length) return {};

  const cerrados: Record<string, string> = {};
  // en tandas: la lista de ids viaja en la URL de la consulta
  for (let i = 0; i < abiertos.length; i += 100) {
    const { data, error } = await sb
      .from('caja_pedidos')
      .select('id, cierre')
      .in('id', abiertos.slice(i, i + 100))
      .neq('cierre', '');
    if (error) return {};
    for (const fila of data ?? []) cerrados[fila.id as string] = fila.cierre as string;
  }
  if (!Object.keys(cerrados).length) return {};

  // se relee: mientras se esperaba a la red pudo entrar un cobro nuevo
  guardarPedidos(leerPedidos().map((p) => (cerrados[p.id] && !p.cierre ? { ...p, cierre: cerrados[p.id] } : p)));
  return cerrados;
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
      cerradosEnPanel: {},
      error: 'SIN_BACKEND',
    };
  }

  const cerradosEnPanel = await bajarCierres(sb);

  const inicial = leerEstado();
  if (!inicial.pendientes.length && !inicial.borrados.length) {
    return { subidos: 0, borrados: 0, pendientes: 0, cerradosEnPanel, error: null };
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
    const { error } = await sb.from('caja_pedidos').upsert(aSubir.map(aFila));
    if (error) {
      return {
        subidos: 0,
        borrados: 0,
        pendientes: cuantosPendientes(),
        cerradosEnPanel,
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
        cerradosEnPanel,
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

  return { subidos, borrados, pendientes: cuantosPendientes(), cerradosEnPanel, error: null };
}
