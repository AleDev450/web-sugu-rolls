-- =====================================================================
-- 017 — Libro de Reclamaciones virtual y política de cookies
-- =====================================================================
-- El Libro de Reclamaciones es obligatorio en Perú (Código de Protección y
-- Defensa del Consumidor, D.S. 011-2011-PCM y su reglamento).
--
-- Requisitos que condicionan el diseño de esta tabla:
--   · CUALQUIERA puede registrar un reclamo, esté logueado o no. Por eso
--     `crear_reclamo` está abierta a `anon`.
--   · Cada hoja lleva un CORRELATIVO visible que se entrega al consumidor
--     como constancia. De ahí el `numero` autoincremental.
--   · Hay 30 días calendario para responder, ampliables otros 30. La fecha
--     de vencimiento se calcula sola para que el panel pueda avisar.
--   · Nada se puede borrar ni editar: el libro debe conservarse. No hay
--     políticas de UPDATE ni DELETE salvo la respuesta del proveedor.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Datos de la empresa: van en site_settings porque son los mismos que
-- encabezan la hoja del libro y deben poder corregirse sin desplegar.
-- ---------------------------------------------------------------------
alter table public.site_settings
  add column if not exists razon_social    text not null default 'INVERSIONES SUGU S.A.C.',
  add column if not exists ruc             text not null default '20608920961',
  add column if not exists cookies         text not null default '';

comment on column public.site_settings.razon_social is
  'Razón social que encabeza el Libro de Reclamaciones.';
comment on column public.site_settings.cookies is
  'Política de cookies en Markdown ligero. Se muestra en /cookies.';

update public.site_settings
set razon_social = 'INVERSIONES SUGU S.A.C.',
    ruc          = '20608920961'
where id = 1 and (razon_social = '' or ruc = '');

-- ---------------------------------------------------------------------
-- Política de cookies inicial.
--
-- Solo se escribe si está vacía: si el administrador ya la editó desde el
-- panel, volver a ejecutar esta migración NO le pisa el texto.
--
-- El contenido describe lo que la web hace de verdad hoy: no hay analítica
-- ni publicidad, solo almacenamiento técnico. Si algún día se añade un
-- medidor, hay que actualizar este texto Y pedir consentimiento.
-- ---------------------------------------------------------------------
update public.site_settings
set cookies = $md$### Qué son las cookies

Las cookies son pequeños archivos que una web guarda en tu navegador para recordar cosas entre una visita y otra. Junto a ellas usamos otras tecnologías parecidas, como el almacenamiento local del navegador, que funcionan igual para lo que aquí te explicamos.

### Qué usamos en esta web

Solo usamos almacenamiento **técnico o necesario**: lo mínimo para que la web funcione. **No usamos cookies de publicidad, de perfilado ni de analítica de terceros**, y no vendemos ni cedemos esta información.

- **Sesión de tu cuenta.** Si te registras o inicias sesión, guardamos un identificador de sesión para mantenerte dentro y mostrarte tus pedidos y tus puntos Sugu Club. Se borra al cerrar sesión.
- **Tu carrito.** Guardamos los productos que vas añadiendo (`sugu_carrito`) para que no se pierdan si recargas o cierras la pestaña por error.
- **Tus preferencias.** Ajustes como el sonido del juego (`sugu_settings`).
- **El juego.** Tu mejor puntaje, las piezas que has desbloqueado y un identificador aleatorio del dispositivo. Ese identificador no dice quién eres: sirve para que un mismo código promocional no se canjee muchas veces desde el mismo equipo.

### Cuánto duran

Las de sesión desaparecen al cerrar sesión o el navegador. Las de carrito, preferencias y juego se quedan en tu equipo hasta que las borres tú desde el navegador.

### Cómo desactivarlas o borrarlas

Puedes borrarlas y bloquearlas cuando quieras desde la configuración de tu navegador, en el apartado de privacidad o datos de navegación. También puedes navegar en modo incógnito.

Ten en cuenta que, al ser almacenamiento necesario, si lo bloqueas **es posible que no puedas iniciar sesión, que el carrito se vacíe al cambiar de página o que el juego no guarde tu puntaje**.

### Cambios

Si cambiamos lo que guardamos, actualizaremos esta página y la fecha de última actualización que aparece arriba.

### Contacto

Si tienes dudas sobre esta política, escríbenos a **Sugurollsperu@gmail.com** o llámanos al **997 516 391**.$md$
where id = 1 and coalesce(trim(cookies), '') = '';

-- ---------------------------------------------------------------------
-- reclamos — una fila por hoja del libro.
-- ---------------------------------------------------------------------
create table if not exists public.reclamos (
  id              uuid primary key default gen_random_uuid(),
  /** correlativo visible; es la constancia que se entrega al consumidor */
  numero          bigserial unique,

  -- identificación del local
  local           text not null default 'Juan Pablo Fernandini 1195, Pueblo Libre',
  canal           text not null default 'Página web',

  -- consumidor
  nombre          text not null,
  domicilio       text not null,
  tipo_documento  text not null,
  documento       text not null,
  correo          text not null,
  telefono        text not null,
  menor_edad      boolean not null default false,
  /** datos del padre o tutor; obligatorios solo si es menor de edad */
  apoderado       text,

  -- bien contratado
  tipo_bien       text not null,
  moneda          text not null default 'PEN',
  monto           numeric(10, 2),
  bien_detalle    text not null,

  -- reclamación
  tipo            text not null,
  fecha_pedido    date,
  numero_pedido   text,
  detalle         text not null,
  pedido_cliente  text not null,

  -- respuesta del proveedor
  estado          text not null default 'pendiente',
  respuesta       text,
  respondido_at   timestamptz,

  created_at      timestamptz not null default now(),

  constraint tipo_valido      check (tipo in ('reclamo', 'queja')),
  constraint tipo_bien_valido check (tipo_bien in ('producto', 'servicio')),
  constraint moneda_valida    check (moneda in ('PEN', 'USD')),
  constraint estado_valido    check (estado in ('pendiente', 'respondido', 'cerrado')),
  constraint doc_valido       check (tipo_documento in ('DNI', 'CE', 'Pasaporte', 'RUC')),
  -- si es menor, tiene que venir el apoderado
  constraint menor_con_apoderado
    check (not menor_edad or (apoderado is not null and length(trim(apoderado)) > 0))
);

comment on table public.reclamos is
  'Libro de Reclamaciones. Contiene datos personales: solo accesible vía funciones y RLS.';

create index if not exists reclamos_pendientes_idx
  on public.reclamos (created_at desc) where estado = 'pendiente';

/** Fecha límite legal de respuesta: 30 días calendario desde el registro. */
create or replace function public.vence_reclamo(p_creado timestamptz)
returns date
language sql
immutable
as $$
  select (p_creado + interval '30 days')::date;
$$;

-- ---------------------------------------------------------------------
-- Registrar un reclamo. Abierto a cualquiera, con o sin cuenta.
--
-- Devuelve el número de hoja: es la constancia que la ley exige entregar.
-- ---------------------------------------------------------------------
create or replace function public.crear_reclamo(p_datos jsonb)
returns table (numero bigint, creado timestamptz, vence date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_fil public.reclamos%rowtype;
  v_txt text;
begin
  -- campos que la ley exige sí o sí
  foreach v_txt in array array['nombre', 'domicilio', 'documento', 'correo', 'telefono',
                               'bien_detalle', 'detalle', 'pedido_cliente']
  loop
    if coalesce(trim(p_datos ->> v_txt), '') = '' then
      raise exception 'FALTA_CAMPO' using hint = 'Falta completar: ' || v_txt;
    end if;
  end loop;

  insert into public.reclamos (
    local, canal, nombre, domicilio, tipo_documento, documento, correo, telefono,
    menor_edad, apoderado, tipo_bien, moneda, monto, bien_detalle,
    tipo, fecha_pedido, numero_pedido, detalle, pedido_cliente
  ) values (
    coalesce(nullif(trim(p_datos ->> 'local'), ''), 'Juan Pablo Fernandini 1195, Pueblo Libre'),
    coalesce(nullif(trim(p_datos ->> 'canal'), ''), 'Página web'),
    trim(p_datos ->> 'nombre'),
    trim(p_datos ->> 'domicilio'),
    coalesce(nullif(trim(p_datos ->> 'tipo_documento'), ''), 'DNI'),
    trim(p_datos ->> 'documento'),
    lower(trim(p_datos ->> 'correo')),
    trim(p_datos ->> 'telefono'),
    coalesce((p_datos ->> 'menor_edad')::boolean, false),
    nullif(trim(coalesce(p_datos ->> 'apoderado', '')), ''),
    coalesce(nullif(trim(p_datos ->> 'tipo_bien'), ''), 'producto'),
    coalesce(nullif(trim(p_datos ->> 'moneda'), ''), 'PEN'),
    nullif(p_datos ->> 'monto', '')::numeric,
    trim(p_datos ->> 'bien_detalle'),
    coalesce(nullif(trim(p_datos ->> 'tipo'), ''), 'reclamo'),
    nullif(p_datos ->> 'fecha_pedido', '')::date,
    nullif(trim(coalesce(p_datos ->> 'numero_pedido', '')), ''),
    trim(p_datos ->> 'detalle'),
    trim(p_datos ->> 'pedido_cliente')
  )
  returning id into v_id;

  select * into v_fil from public.reclamos where reclamos.id = v_id;

  numero := v_fil.numero;
  creado := v_fil.created_at;
  vence  := public.vence_reclamo(v_fil.created_at);
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- PANEL: ver el libro y responder.
-- ---------------------------------------------------------------------
create or replace function public.admin_reclamos(
  p_estado text default null,
  p_limit  integer default 200
)
returns table (
  id uuid, numero bigint, estado text, tipo text, tipo_bien text,
  nombre text, domicilio text, tipo_documento text, documento text,
  correo text, telefono text, menor_edad boolean, apoderado text,
  local text, canal text, moneda text, monto numeric, bien_detalle text,
  fecha_pedido date, numero_pedido text, detalle text, pedido_cliente text,
  respuesta text, respondido_at timestamptz, creado timestamptz, vence date
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.numero, r.estado, r.tipo, r.tipo_bien,
         r.nombre, r.domicilio, r.tipo_documento, r.documento,
         r.correo, r.telefono, r.menor_edad, r.apoderado,
         r.local, r.canal, r.moneda, r.monto, r.bien_detalle,
         r.fecha_pedido, r.numero_pedido, r.detalle, r.pedido_cliente,
         r.respuesta, r.respondido_at, r.created_at,
         public.vence_reclamo(r.created_at)
  from public.reclamos r
  where public.is_admin()
    and (p_estado is null or r.estado = p_estado)
  order by r.created_at desc
  limit least(coalesce(p_limit, 200), 500);
$$;

create or replace function public.admin_responder_reclamo(
  p_id        uuid,
  p_respuesta text,
  p_estado    text default 'respondido'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_estado not in ('pendiente', 'respondido', 'cerrado') then
    raise exception 'ESTADO_INVALIDO';
  end if;

  update public.reclamos
  set respuesta     = nullif(trim(coalesce(p_respuesta, '')), ''),
      estado        = p_estado,
      respondido_at = case when p_estado = 'pendiente' then null else now() end
  where id = p_id;

  if not found then
    raise exception 'RECLAMO_NO_EXISTE';
  end if;
end;
$$;

-- =====================================================================
-- RLS: el libro no lo lee nadie salvo el administrador
-- =====================================================================

alter table public.reclamos enable row level security;

drop policy if exists "reclamos: solo admin" on public.reclamos;
create policy "reclamos: solo admin"
  on public.reclamos for select
  using (public.is_admin());

-- Sin políticas de INSERT/UPDATE/DELETE: se escribe SOLO por las funciones.
-- Un reclamo registrado no se puede borrar ni alterar, que es justo lo que
-- exige la norma para el libro.

revoke all on public.reclamos from anon, authenticated;
grant select on public.reclamos to authenticated;  -- filtrado por RLS

grant execute on function public.crear_reclamo(jsonb)                       to anon, authenticated;
grant execute on function public.vence_reclamo(timestamptz)                 to anon, authenticated;
grant execute on function public.admin_reclamos(text, integer)              to authenticated;
grant execute on function public.admin_responder_reclamo(uuid, text, text)  to authenticated;
revoke execute on function public.admin_reclamos(text, integer)             from anon;
revoke execute on function public.admin_responder_reclamo(uuid, text, text) from anon;
