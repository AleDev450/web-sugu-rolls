'use client';

import { getSupabase } from '@/lib/supabase/client';

/**
 * "Trabaja con nosotros": postula CUALQUIERA, con cuenta o sin ella. El CV
 * sube primero al bucket privado `cv-postulantes` y luego la fila se crea con
 * `crear_postulacion` (SECURITY DEFINER): la tabla queda cerrada a lectura,
 * nadie puede listar postulaciones ajenas desde la clave pública.
 */

export interface FormularioPostulacion {
  nombre: string;
  correo: string;
  telefono: string;
  puesto: string;
  mensaje: string;
}

const TIPOS_CV = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_CV_BYTES = 5 * 1024 * 1024;

export async function enviarPostulacion(
  datos: FormularioPostulacion,
  cv: File
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      'La postulación no está disponible en este momento. Escríbenos por WhatsApp.'
    );
  }

  if (!TIPOS_CV.includes(cv.type)) {
    throw new Error('El CV debe ser un PDF o un documento de Word.');
  }
  if (cv.size > MAX_CV_BYTES) {
    throw new Error('El CV no puede pasar de 5 MB.');
  }

  const ext = cv.name.split('.').pop()?.toLowerCase() ?? 'pdf';
  const ruta = `${crypto.randomUUID()}.${ext}`;

  const { error: falloSubida } = await sb.storage
    .from('cv-postulantes')
    .upload(ruta, cv, { contentType: cv.type, upsert: false });
  if (falloSubida) throw new Error('No se pudo subir el CV. Inténtalo de nuevo.');

  const { error } = await sb.rpc('crear_postulacion', {
    p_nombre: datos.nombre.trim(),
    p_correo: datos.correo.trim(),
    p_telefono: datos.telefono.trim(),
    p_cv_path: ruta,
    p_puesto: datos.puesto.trim() || null,
    p_mensaje: datos.mensaje.trim() || null,
  });

  if (error) {
    if (error.message.includes('Could not find the function')) {
      throw new Error('Falta ejecutar la migración 026 en Supabase.');
    }
    throw new Error('No se pudo registrar tu postulación. Inténtalo de nuevo.');
  }
}
