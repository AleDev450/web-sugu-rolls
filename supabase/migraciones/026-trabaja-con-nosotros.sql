-- =====================================================================
-- 026 — Trabaja con nosotros
-- =====================================================================
-- Sección pública de postulación: cualquiera puede postular, con o sin
-- cuenta, dejando sus datos y adjuntando su CV. El panel las lista y
-- descarga el CV con un enlace firmado, igual que los comprobantes de pago.
--
--   · CUALQUIERA puede postular: `crear_postulacion` está abierta a `anon`,
--     igual que `crear_reclamo`.
--   · El CV va a un bucket PRIVADO (`cv-postulantes`): son datos personales,
--     no se sirven por URL pública. Solo el admin los lee, con un enlace
--     firmado de un solo uso.
--   · Nada se puede editar ni borrar desde la web: solo se lee desde el
--     panel. Si algún día hace falta marcar "revisado", se añade ahí.
--
-- Idempotente.
-- =====================================================================

create table if not exists public.job_applications (
  id          uuid primary key default gen_random_uuid(),

  nombre      text not null,
  correo      text not null,
  telefono    text not null,
  puesto      text,
  mensaje     text,
  /** ruta en el bucket privado `cv-postulantes` */
  cv_path     text not null,

  created_at  timestamptz not null default now()
);

comment on table public.job_applications is
  'Postulaciones de "Trabaja con nosotros". Contiene datos personales: solo accesible vía funciones y RLS.';

create index if not exists job_applications_creado_idx
  on public.job_applications (created_at desc);

-- ---------------------------------------------------------------------
-- Registrar una postulación. Abierta a cualquiera, con o sin cuenta.
-- ---------------------------------------------------------------------
create or replace function public.crear_postulacion(
  p_nombre   text,
  p_correo   text,
  p_telefono text,
  p_cv_path  text,
  p_puesto   text default null,
  p_mensaje  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'FALTA_CAMPO' using hint = 'Falta completar: nombre';
  end if;
  if coalesce(trim(p_correo), '') = '' then
    raise exception 'FALTA_CAMPO' using hint = 'Falta completar: correo';
  end if;
  if coalesce(trim(p_telefono), '') = '' then
    raise exception 'FALTA_CAMPO' using hint = 'Falta completar: telefono';
  end if;
  if coalesce(trim(p_cv_path), '') = '' then
    raise exception 'FALTA_CV';
  end if;

  insert into public.job_applications (nombre, correo, telefono, puesto, mensaje, cv_path)
  values (
    trim(p_nombre),
    lower(trim(p_correo)),
    trim(p_telefono),
    nullif(trim(coalesce(p_puesto, '')), ''),
    nullif(trim(coalesce(p_mensaje, '')), ''),
    trim(p_cv_path)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- PANEL: listar postulaciones.
-- ---------------------------------------------------------------------
create or replace function public.admin_postulaciones(p_limit integer default 200)
returns table (
  id uuid, nombre text, correo text, telefono text, puesto text,
  mensaje text, cv_path text, creado timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select j.id, j.nombre, j.correo, j.telefono, j.puesto, j.mensaje, j.cv_path, j.created_at
  from public.job_applications j
  where public.is_admin()
  order by j.created_at desc
  limit least(coalesce(p_limit, 200), 500);
$$;

-- =====================================================================
-- RLS: las postulaciones no las lee nadie salvo el administrador
-- =====================================================================

alter table public.job_applications enable row level security;

drop policy if exists "postulaciones: solo admin" on public.job_applications;
create policy "postulaciones: solo admin"
  on public.job_applications for select
  using (public.is_admin());

-- Sin políticas de INSERT/UPDATE/DELETE: se escribe SOLO por la función.

revoke all on public.job_applications from anon, authenticated;
grant select on public.job_applications to authenticated;  -- filtrado por RLS

grant execute on function public.crear_postulacion(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_postulaciones(integer)                          to authenticated;
revoke execute on function public.admin_postulaciones(integer)                         from anon;

-- ---------------------------------------------------------------------
-- Almacén de CVs: PRIVADO.
--
-- Cualquiera puede subir el suyo al postular (igual que el bucket no
-- necesita cuenta), pero solo el admin puede listarlos o leerlos.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cv-postulantes', 'cv-postulantes', false, 5242880,
        array['application/pdf', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cv-postulantes: cualquiera sube el suyo" on storage.objects;
create policy "cv-postulantes: cualquiera sube el suyo"
  on storage.objects for insert
  with check (bucket_id = 'cv-postulantes');

drop policy if exists "cv-postulantes: solo admin los ve" on storage.objects;
create policy "cv-postulantes: solo admin los ve"
  on storage.objects for select
  using (bucket_id = 'cv-postulantes' and public.is_admin());
