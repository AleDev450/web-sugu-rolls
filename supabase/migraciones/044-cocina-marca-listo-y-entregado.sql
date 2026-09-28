-- =====================================================================
-- 044 — La cocina marca "listo" y "entregado al cliente"
-- =====================================================================
-- Hasta ahora la cocina solo miraba: un pedido salía de su pantalla cuando
-- el CAJERO tocaba "Entregar". Eso fallaba en dos casos de todos los días:
--
--   · El cajero sale a comprar algo y deja pedidos apuntados. La cocina los
--     prepara y se los da al cliente, pero no puede marcarlos: se quedan
--     en su pantalla como si faltaran.
--   · La cocina ya terminó y le pasó el plato a la caja, pero el cliente
--     tarda en recogerlo. Mientras el cajero no entregue, la cocina lo
--     sigue viendo como pendiente y le estorba la cola.
--
-- Ahora la cocina tiene su propio estado del pedido, en columnas aparte:
--
--   cocina_estado = ''          → por preparar
--                 = 'listo'     → terminado; sale de la cola y queda en
--                                 "listos para recoger" (lo tiene la caja o
--                                 espera en cocina a que pasen por él)
--                 = 'entregado' → la cocina se lo dio directo al cliente
--
-- Van APARTE de `entregado` a propósito. La tablet sube el pedido entero y
-- sin estas columnas, así que un upsert suyo nunca pisa lo que marcó la
-- cocina. La tablet las baja al sincronizar y, si la cocina entregó, pasa
-- el pedido a entregado también en la caja.
--
-- La cocina sigue sin ver plata: solo recibe si el pedido está PAGADO o
-- no, para no entregar sin cobrar.
--
-- Idempotente.
-- =====================================================================

alter table public.caja_pedidos
  add column if not exists cocina_estado text not null default '',
  add column if not exists cocina_en     timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'caja_pedidos_cocina_estado_chk'
  ) then
    alter table public.caja_pedidos
      add constraint caja_pedidos_cocina_estado_chk
      check (cocina_estado in ('', 'listo', 'entregado'));
  end if;
end;
$$;

comment on column public.caja_pedidos.cocina_estado is
  'Lo que marcó la cocina: '''' por preparar, ''listo'' terminado, ''entregado'' se lo dio al cliente.';

-- Si el cajero "devuelve" un pedido que la cocina había entregado, la caja
-- limpia estas columnas con un update aparte. No se hace con un trigger
-- sobre `entregado`: un upsert atrasado de la tablet (entregado = false
-- porque aún no se enteró) se confundiría con un "devolver" y borraría la
-- entrega de la cocina.

-- ---------------------------------------------------------------------
-- La cola de la cocina: por preparar y listos, con el aviso de pago
-- ---------------------------------------------------------------------

-- cambia el tipo de retorno, así que hay que borrarla antes; el grant se repone abajo
drop function if exists public.cocina_pendientes(text, text);

create function public.cocina_pendientes(
  p_clave    text,
  p_vendedor text default null
)
returns table (
  id            uuid,
  numero        integer,
  creado        timestamptz,
  cliente       text,
  vendedor      text,
  nota          text,
  lineas        jsonb,
  pagado        boolean,
  cocina_estado text,
  cocina_en     timestamptz
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
    select c.id, c.numero, c.creado, c.cliente, c.vendedor, c.nota, c.lineas,
           c.pagado, c.cocina_estado, c.cocina_en
    from public.caja_pedidos c
    where not c.entregado
      and c.cocina_estado <> 'entregado'
      and c.cierre = ''
      and lower(trim(c.vendedor)) = lower(trim(p_vendedor))
    order by c.creado asc
    limit 300;
end;
$$;

grant execute on function public.cocina_pendientes(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Lo que la cocina puede escribir: solo su estado, solo en pedidos de la
-- caja abierta de su cajero, y solo con la clave del enlace.
-- ---------------------------------------------------------------------
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
      cocina_en     = case when p_estado = '' then null else now() end,
      -- entregado por la cocina es entregado para todos: panel y estadísticas lo ven ya
      entregado     = case when p_estado = 'entregado' then true else c.entregado end,
      entregado_en  = case
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

notify pgrst, 'reload schema';
