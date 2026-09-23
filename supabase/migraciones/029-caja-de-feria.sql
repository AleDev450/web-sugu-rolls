-- =====================================================================
-- 029 — Caja de feria (/calculator) visible en el panel
-- =====================================================================
-- La caja de la feria nació guardando todo en el `localStorage` de la
-- tablet: en un puesto no hay señal garantizada y un cobro perdido por un
-- timeout es peor que uno que no salió del equipo. Eso sigue igual —la
-- tablet manda—, pero ahora además sincroniza aquí para que /admin/caja
-- pueda ver lo vendido sin tener que pedir prestada la tablet.
--
-- Decisiones que explican la forma de la tabla:
--
--   · El `id` NO se genera aquí: llega el que creó la tablet. Así la
--     sincronización es idempotente —se reintenta con `upsert` y el mismo
--     pedido no entra dos veces— aunque se corte la conexión a mitad.
--
--   · `creado` tampoco es `now()`: es la hora en que se tocó "Registrar"
--     en el puesto, que puede ser horas antes de que haya internet. La
--     hora del servidor vive aparte, en `created_at`.
--
--   · `lineas` va en jsonb y no en una tabla aparte. Un ticket de feria se
--     lee entero o no se lee: nunca se consulta una línea suelta, y en
--     cambio sí se exporta el pedido completo. Una tabla hija solo añadiría
--     una unión a cada lectura.
--
--   · `vendedor` es quién ATENDIÓ, escrito en la caja; `usuario_email` es
--     con qué cuenta se estaba logueado, y lo sella el servidor. Son dos
--     cosas distintas a propósito: varias personas pueden turnarse en la
--     misma tablet con una sola sesión abierta.
--
-- Solo el administrador entra: la caja exige sesión igual que /admin, y
-- RLS lo vuelve a comprobar del lado del servidor.
--
-- Idempotente.
-- =====================================================================

create table if not exists public.caja_pedidos (
  /** el uuid que generó la tablet; hace la sincronización idempotente */
  id            uuid primary key,

  /** hora real del cobro en el puesto, no la de llegada al servidor */
  creado        timestamptz not null,

  cliente       text not null default 'Cliente',
  /** quién atendió, elegido en la caja; puede no ser el dueño de la sesión */
  vendedor      text not null default '',

  /** [{producto, promo, sabores, cantidad, unitario, total}] */
  lineas        jsonb not null default '[]'::jsonb,
  total         numeric(10, 2) not null default 0,

  metodo        text not null default 'efectivo',
  pagado        boolean not null default false,
  entregado     boolean not null default false,

  -- sellado por el servidor en el alta; el cliente no puede mentir aquí
  usuario_id    uuid references auth.users(id) on delete set null,
  usuario_email text not null default '',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint caja_metodo_valido check (metodo in ('efectivo', 'yape')),
  constraint caja_total_no_negativo check (total >= 0)
);

comment on table public.caja_pedidos is
  'Ventas de la caja de feria (/calculator). La tablet es la fuente: esto es la copia sincronizada que lee el panel.';
comment on column public.caja_pedidos.id is
  'Generado por la tablet. Permite reintentar la subida con upsert sin duplicar.';
comment on column public.caja_pedidos.creado is
  'Hora del cobro en el puesto. created_at es cuándo llegó al servidor.';
comment on column public.caja_pedidos.vendedor is
  'Quién atendió, elegido en la caja. Distinto de usuario_email, que es la sesión.';

-- el panel siempre lee por fecha descendente y a veces filtra por vendedor
create index if not exists caja_pedidos_creado_idx
  on public.caja_pedidos (creado desc);
create index if not exists caja_pedidos_vendedor_idx
  on public.caja_pedidos (vendedor, creado desc);

-- ---------------------------------------------------------------------
-- Sello de autoría.
--
-- El usuario se toma de la sesión, NO de lo que mande el cliente, y solo
-- en el alta: si mañana el administrador marca "entregado" desde el panel,
-- el pedido debe seguir diciendo quién lo cobró.
-- ---------------------------------------------------------------------
create or replace function public.caja_sellar()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.usuario_id    := auth.uid();
    new.usuario_email := coalesce(auth.jwt() ->> 'email', '');
    new.created_at    := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists caja_sellar_trg on public.caja_pedidos;
create trigger caja_sellar_trg
  before insert or update on public.caja_pedidos
  for each row execute function public.caja_sellar();

-- =====================================================================
-- RLS: la caja es del administrador y de nadie más
-- =====================================================================

alter table public.caja_pedidos enable row level security;

drop policy if exists "caja: solo admin" on public.caja_pedidos;
create policy "caja: solo admin"
  on public.caja_pedidos for all
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.caja_pedidos from anon, authenticated;
-- filtrado por RLS: sin sesión de admin, estas concesiones no devuelven nada
grant select, insert, update, delete on public.caja_pedidos to authenticated;
