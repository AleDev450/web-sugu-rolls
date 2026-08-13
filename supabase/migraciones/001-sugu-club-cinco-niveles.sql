-- =====================================================================
-- 001 — Sugu Club: cinco niveles (Bronce · Plata · Oro · Platino · Black)
-- =====================================================================
-- Antes eran cuatro y el primero se llamaba "normal". Si en tu perfil sigues
-- viendo "Normal" y "500 puntos para Oro", es que falta esta migración.
--
-- Idempotente: se puede correr las veces que haga falta.
-- =====================================================================

create or replace function public.corte_nivel(p_nivel text)
returns integer
language sql
immutable
as $$
  select case p_nivel
    when 'bronce'  then 0
    when 'plata'   then 300
    when 'oro'     then 800
    when 'platino' then 2000
    when 'black'   then 4000
  end;
$$;

create or replace function public.nivel_cliente(p_ganados integer)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_ganados, 0) >= public.corte_nivel('black')   then 'black'
    when coalesce(p_ganados, 0) >= public.corte_nivel('platino') then 'platino'
    when coalesce(p_ganados, 0) >= public.corte_nivel('oro')     then 'oro'
    when coalesce(p_ganados, 0) >= public.corte_nivel('plata')   then 'plata'
    else 'bronce'
  end;
$$;

create or replace function public.mi_tarjeta()
returns table (
  saldo     integer,
  ganados   integer,
  nivel     text,
  siguiente text,
  faltan    integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ganados integer;
begin
  saldo := public.saldo_puntos();
  v_ganados := public.puntos_ganados();
  ganados := v_ganados;
  nivel := public.nivel_cliente(v_ganados);

  siguiente := case nivel
    when 'bronce'  then 'plata'
    when 'plata'   then 'oro'
    when 'oro'     then 'platino'
    when 'platino' then 'black'
    else null
  end;

  faltan := case
    when siguiente is null then 0
    else public.corte_nivel(siguiente) - v_ganados
  end;

  return next;
end;
$$;

grant execute on function public.corte_nivel(text)      to anon, authenticated;
grant execute on function public.nivel_cliente(integer) to anon, authenticated;
grant execute on function public.mi_tarjeta()           to authenticated;
