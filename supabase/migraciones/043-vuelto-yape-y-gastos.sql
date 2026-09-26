-- =====================================================================
-- 043 — Vuelto por Yape, gastos y retiros de la caja de feria
-- =====================================================================
-- Tres cosas que movían plata sin quedar anotadas, y por las que el cajón
-- nunca cuadraba con lo cobrado:
--
--   1. VUELTO POR YAPE. Cuando no hay sencillo, el cliente paga en efectivo
--      de más y el vuelto se le manda por Yape. Entra efectivo extra al
--      cajón y sale la misma cantidad del Yape. Va en el pedido.
--
--   2. GASTOS. El motorizado, la comida, el agua… pagados con plata de la
--      caja (efectivo o Yape).
--
--   3. RETIROS. Efectivo que alguien sacó del cajón. No es gasto —la plata
--      sigue siendo del negocio—, pero ya no está en el cajón.
--
-- Gastos y retiros van en `caja_movimientos`, que sigue las mismas reglas
-- que `caja_pedidos`: los crea la tablet con su propio id (subir es
-- idempotente), se sellan con el nombre del cierre, y un movimiento ya
-- cerrado no se reabre (migración 040).
--
-- Idempotente.
-- =====================================================================

alter table public.caja_pedidos
  add column if not exists vuelto_yape numeric(10, 2) not null default 0;

comment on column public.caja_pedidos.vuelto_yape is
  'Vuelto devuelto por Yape: efectivo que entró de más al cajón y salió del Yape.';

create table if not exists public.caja_movimientos (
  id         text primary key,
  creado     timestamptz not null,
  vendedor   text not null default '',
  cierre     text not null default '',
  tipo       text not null check (tipo in ('gasto', 'retiro')),
  concepto   text not null default '',
  monto      numeric(10, 2) not null check (monto >= 0),
  medio      text not null default 'efectivo' check (medio in ('efectivo', 'yape')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.caja_movimientos is
  'Gastos y retiros de efectivo de la caja de feria. cierre vacío = caja todavía abierta.';

create index if not exists caja_movimientos_creado_idx
  on public.caja_movimientos (creado desc);

-- un movimiento cerrado no cambia de cierre, igual que un pedido
create or replace function public.caja_movimiento_cierre_fijo()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(old.cierre, '') <> '' then
    new.cierre := old.cierre;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists caja_movimiento_cierre_fijo_trg on public.caja_movimientos;
create trigger caja_movimiento_cierre_fijo_trg
  before update on public.caja_movimientos
  for each row execute function public.caja_movimiento_cierre_fijo();

alter table public.caja_movimientos enable row level security;

drop policy if exists "movimientos de caja: solo admin" on public.caja_movimientos;
create policy "movimientos de caja: solo admin"
  on public.caja_movimientos for all
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.caja_movimientos from anon, authenticated;
grant select, insert, update, delete on public.caja_movimientos to authenticated;

notify pgrst, 'reload schema';
