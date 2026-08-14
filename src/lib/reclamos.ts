'use client';

import { getSupabase } from '@/lib/supabase/client';

/**
 * Libro de Reclamaciones virtual.
 *
 * Lo registra CUALQUIERA, con cuenta o sin ella: la ley no permite exigir
 * registro previo para reclamar. Por eso la escritura pasa por la función
 * `crear_reclamo` (SECURITY DEFINER) en vez de por un INSERT directo — así la
 * tabla queda cerrada a lectura y nadie puede listar los datos personales de
 * los demás desde la clave pública.
 */

export type TipoDocumento = 'DNI' | 'CE' | 'Pasaporte' | 'RUC';

export interface FormularioReclamo {
  /** identificación del local */
  local: string;
  canal: string;

  /** identificación del consumidor reclamante */
  nombre: string;
  domicilio: string;
  tipo_documento: TipoDocumento;
  documento: string;
  correo: string;
  telefono: string;
  menor_edad: boolean;
  /** nombre y documento del padre, madre o apoderado; solo si es menor */
  apoderado: string;

  /** identificación del bien contratado */
  tipo_bien: 'producto' | 'servicio';
  moneda: 'PEN' | 'USD';
  monto: string;
  bien_detalle: string;

  /** detalle de la reclamación y pedido del consumidor */
  tipo: 'reclamo' | 'queja';
  fecha_pedido: string;
  numero_pedido: string;
  detalle: string;
  pedido_cliente: string;
}

/** Constancia que se le entrega al consumidor tras registrar la hoja. */
export interface Constancia {
  numero: number;
  creado: string;
  /** fecha límite legal de respuesta: 30 días calendario */
  vence: string;
}

/**
 * Registra la hoja y devuelve su correlativo.
 *
 * El número es la constancia: es lo único que le queda al consumidor para
 * demostrar que reclamó, así que se muestra en pantalla y se manda por
 * correo desde el panel.
 */
export async function crearReclamo(datos: FormularioReclamo): Promise<Constancia> {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      'El libro no está disponible en este momento. Escríbenos por WhatsApp y lo registramos nosotros.'
    );
  }

  const { data, error } = await sb.rpc('crear_reclamo', {
    p_datos: {
      ...datos,
      // el panel lo guarda como número; vacío significa "no aplica"
      monto: datos.monto.trim(),
      fecha_pedido: datos.fecha_pedido || null,
    },
  });

  if (error) throw new Error(traducir(error.message, error.hint));

  const fila = (Array.isArray(data) ? data[0] : data) as Constancia | undefined;
  if (!fila) throw new Error('No se pudo registrar el reclamo. Vuelve a intentarlo.');
  return fila;
}

/** Nombre de columna -> etiqueta que ve el consumidor en el formulario. */
const ETIQUETAS: Record<string, string> = {
  nombre: 'Nombre completo',
  domicilio: 'Domicilio',
  documento: 'Número de documento',
  correo: 'Correo electrónico',
  telefono: 'Teléfono',
  bien_detalle: 'Descripción del producto o servicio',
  detalle: 'Detalle del producto o servicio adquirido',
  pedido_cliente: 'Pedido del consumidor',
};

/** Mensajes de Postgres a algo que se entienda sin ser programador. */
function traducir(mensaje: string, pista?: string | null): string {
  if (mensaje.includes('FALTA_CAMPO')) {
    const campo = pista?.replace('Falta completar: ', '').trim() ?? '';
    return `Falta completar: ${ETIQUETAS[campo] ?? campo}.`;
  }
  if (mensaje.includes('menor_con_apoderado')) {
    return 'Si eres menor de edad, indica el nombre y documento de tu padre, madre o apoderado.';
  }
  if (mensaje.includes('doc_valido')) return 'El tipo de documento no es válido.';
  if (mensaje.includes('Could not find the function')) {
    return 'Falta ejecutar la migración 017 en Supabase.';
  }
  console.error('crear_reclamo:', mensaje, pista);
  return mensaje;
}
