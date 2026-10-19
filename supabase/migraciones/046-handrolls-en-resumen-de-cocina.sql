-- Handrolls elaborados hoy, visibles en el resumen de la tablet de cocina.
-- Solo cuentan pedidos marcados "listo" o "entregado" por esta cocina.
-- El día se calcula en horario de Perú, aunque la caja ya se haya cerrado.
-- La clave del enlace autoriza solo cifras agregadas del cajero, sin cobros.

-- "Entregado" después de "Listo" conserva la hora en que se terminó.
-- Los pedidos entregados directamente reciben la hora de entrega.
create or replace function public.cocina_marcar(
  p_clave    text,
  p_vendedor text,
  p_id       uuid,
  p_estado   text
)
returns void
language plpgsql
volatile
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

  if p_estado not in ('', 'listo', 'entregado') then
    raise exception 'ESTADO_INVALIDO';
  end if;

  update public.caja_pedidos c
  set cocina_estado = p_estado,
      cocina_en = case
        when p_estado = '' then null
        when p_estado = 'entregado' and c.cocina_estado = 'listo'
          then coalesce(c.cocina_en, now())
        else now()
      end,
      entregado = case when p_estado = 'entregado' then true else c.entregado end,
      entregado_en = case
        when p_estado = 'entregado' then coalesce(c.entregado_en, now())
        else c.entregado_en
      end
  where c.id = p_id
    and c.cierre = ''
    and lower(trim(c.vendedor)) = lower(trim(p_vendedor));

  if not found then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;
end;
$$;

grant execute on function public.cocina_marcar(text, text, uuid, text) to anon, authenticated;

drop function if exists public.cocina_resumen(text, text);

create function public.cocina_resumen(
  p_clave    text,
  p_vendedor text default null
)
returns table (
  rolls                numeric,
  onigiris             integer,
  pokebowls            integer,
  pedidos              integer,
  handrolls            integer,
  handrolls_pollo      integer,
  handrolls_langostino integer,
  handrolls_otros      integer
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
  ),
  resumen_turno as (
    select
      coalesce(sum(
      case when l ->> 'producto' = 'maki'
        then coalesce((l ->> 'cantidad')::int, 0)
          * case l ->> 'promo'
              when 'duo' then 2
              when 'cinco' then 0.5
              else 1
            end
        else 0
      end
      ), 0)::numeric as rolls,
      coalesce(sum(case when l ->> 'producto' = 'onigiri'
        then coalesce((l ->> 'cantidad')::int, 0) else 0 end), 0)::int as onigiris,
      coalesce(sum(case when l ->> 'producto' = 'pokebowl'
        then coalesce((l ->> 'cantidad')::int, 0) else 0 end), 0)::int as pokebowls,
      count(distinct renglones.id)::int as pedidos
    from renglones
  ),
  handrolls_dia as (
    select l
    from public.caja_pedidos c
    cross join lateral jsonb_array_elements(c.lineas) l
    where lower(trim(c.vendedor)) = lower(trim(p_vendedor))
      and c.cocina_estado in ('listo', 'entregado')
      and (c.cocina_en at time zone 'America/Lima')::date
          = (now() at time zone 'America/Lima')::date
      and l ->> 'producto' = 'handroll'
  ),
  resumen_handrolls as (
    select
      coalesce(sum(coalesce((l ->> 'cantidad')::int, 0)), 0)::int as total,
      coalesce(sum(case when l ->> 'promo' = 'handroll_pollo'
        then coalesce((l ->> 'cantidad')::int, 0) else 0 end), 0)::int as pollo,
      coalesce(sum(case when l ->> 'promo' = 'handroll_langostino'
        then coalesce((l ->> 'cantidad')::int, 0) else 0 end), 0)::int as langostino,
      coalesce(sum(case when coalesce(l ->> 'promo', '') not in ('handroll_pollo', 'handroll_langostino')
        then coalesce((l ->> 'cantidad')::int, 0) else 0 end), 0)::int as otros
    from handrolls_dia
  )
  select t.rolls, t.onigiris, t.pokebowls, t.pedidos,
         h.total, h.pollo, h.langostino, h.otros
  from resumen_turno t cross join resumen_handrolls h;
end;
$$;

grant execute on function public.cocina_resumen(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
