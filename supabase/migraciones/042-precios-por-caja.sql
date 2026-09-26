-- =====================================================================
-- 042 — Precios de la caja editables desde el panel, por cajero
-- =====================================================================
-- Los precios de /calculator estaban escritos en el código. Ahora el panel
-- (/admin/caja → Precios) puede cambiarlos, y ponerle a una caja precios
-- distintos de las demás: en una feria el maki puede costar más que en
-- otra.
--
-- Cada fila es una capa de precios:
--   · caja = ''        → precio BASE de todas las cajas
--   · caja = 'ana'     → precios propios de la caja de ese cajero
--                        (nombre en minúsculas y sin espacios de más)
--
-- `precios` es un jsonb { clave: precio }, donde la clave es el id de la
-- presentación ('duo', 'cinco', 'pollo'…) o del producto ('onigiri'). Lo
-- que no está en la fila se hereda: carta ← base ← caja del cajero.
--
-- También: el maki de 5 piezas es medio roll. La cocina cuenta rolls, así
-- que `cocina_resumen` pasa a devolver números con decimales.
--
-- Idempotente.
-- =====================================================================

create table if not exists public.caja_precios (
  caja       text primary key,
  /** nombre del cajero tal como se escribió, para mostrarlo en el panel */
  nombre     text not null default '',
  precios    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.caja_precios is
  'Precios de la caja de feria. caja = '''' es el precio base; si no, la caja de ese cajero (en minúsculas).';

alter table public.caja_precios enable row level security;

drop policy if exists "precios de caja: solo admin" on public.caja_precios;
create policy "precios de caja: solo admin"
  on public.caja_precios for all
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.caja_precios from anon, authenticated;
-- filtrado por RLS: la caja abre con sesión de admin, igual que caja_pedidos
grant select, insert, update, delete on public.caja_precios to authenticated;

-- ---------------------------------------------------------------------
-- Cocina: el de 5 piezas cuenta medio roll
-- ---------------------------------------------------------------------

-- cambia el tipo de retorno, así que hay que borrarla antes; el grant se repone abajo
drop function if exists public.cocina_resumen(text, text);

create or replace function public.cocina_resumen(
  p_clave    text,
  p_vendedor text default null
)
returns table (
  rolls     numeric,
  onigiris  integer,
  pokebowls integer,
  pedidos   integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(p_clave, '') = ''
     or not exists (select 1 from public.caja_cocina k where k.id = 1 and k.clave = p_clave)
  then
    raise exception 'CLAVE_INVALIDA';
  end if;

  if coalesce(trim(p_vendedor), '') = '' then
    raise exception 'VENDEDOR_REQUERIDO';
  end if;

  return query
  with abiertos as (
    select c.id, c.lineas
    from public.caja_pedidos c
    where c.cierre = ''
      and lower(trim(c.vendedor)) = lower(trim(p_vendedor))
  ),
  renglones as (
    select a.id, l
    from abiertos a
    left join lateral jsonb_array_elements(a.lineas) l on true
  )
  select
    coalesce(
      sum(
        case
          when l ->> 'producto' = 'maki'
          then coalesce((l ->> 'cantidad')::int, 0)
               * case l ->> 'promo'
                   when 'duo'   then 2
                   when 'cinco' then 0.5
                   else 1
                 end
          else 0
        end
      ),
      0
    )::numeric,
    coalesce(
      sum(case when l ->> 'producto' = 'onigiri' then coalesce((l ->> 'cantidad')::int, 0) else 0 end),
      0
    )::int,
    coalesce(
      sum(case when l ->> 'producto' = 'pokebowl' then coalesce((l ->> 'cantidad')::int, 0) else 0 end),
      0
    )::int,
    count(distinct renglones.id)::int
  from renglones;
end;
$$;

grant execute on function public.cocina_resumen(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
