import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Alta de clientes de la web, SIN correo de confirmación.
 *
 * El registro normal (`auth.signUp` desde el navegador) obedece al ajuste
 * "Confirm email" del proyecto: si está activo manda un correo y deja la
 * cuenta bloqueada hasta que alguien abra el enlace. Aquí se crea el usuario
 * con la clave de servicio y `email_confirm: true`, así que nace confirmado y
 * puede entrar en el acto. No se envía ningún correo, pase lo que pase con ese
 * ajuste.
 *
 * La clave de servicio SALTA TODAS LAS POLÍTICAS RLS: por eso vive solo aquí,
 * en el servidor, y nunca en una variable NEXT_PUBLIC_. Esta ruta hace una
 * única cosa —crear la cuenta— y no acepta ningún campo que dé privilegios.
 */

export const runtime = 'nodejs';

interface Cuerpo {
  correo?: string;
  clave?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  direccion?: string;
}

const limpio = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) {
    return NextResponse.json(
      { error: 'SIN_CONFIGURAR', mensaje: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.' },
      { status: 501 }
    );
  }

  let body: Cuerpo;
  try {
    body = (await req.json()) as Cuerpo;
  } catch {
    return NextResponse.json({ error: 'CUERPO_INVALIDO' }, { status: 400 });
  }

  const correo = limpio(body.correo).toLowerCase();
  const password = typeof body.clave === 'string' ? body.clave : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return NextResponse.json(
      { error: 'CORREO_INVALIDO', mensaje: 'Revisa el correo, no parece válido.' },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'CLAVE_CORTA', mensaje: 'La contraseña debe tener al menos 6 caracteres.' },
      { status: 400 }
    );
  }

  const admin = createClient(url, clave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
    // los recoge el trigger `handle_new_user` y los copia a `profiles`
    user_metadata: {
      full_name: limpio(body.nombre),
      last_name: limpio(body.apellido),
      phone: limpio(body.telefono),
      address: limpio(body.direccion),
    },
  });

  if (error) {
    const yaExiste =
      error.message.toLowerCase().includes('already') ||
      error.message.toLowerCase().includes('registered');
    return NextResponse.json(
      {
        error: yaExiste ? 'CORREO_EN_USO' : 'NO_CREADO',
        mensaje: yaExiste
          ? 'Ese correo ya tiene una cuenta. Inicia sesión.'
          : 'No se pudo crear la cuenta. Inténtalo de nuevo.',
      },
      { status: yaExiste ? 409 : 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
