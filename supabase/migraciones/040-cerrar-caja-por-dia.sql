-- =====================================================================
-- 040 — Cerrar la caja por día desde el panel
-- =====================================================================
-- A veces quien atiende se olvida de cerrar caja y al día siguiente sigue
-- cobrando sobre la misma: dos jornadas quedan mezcladas en un solo
-- cierre. Desde /admin/caja ahora se puede cerrar lo que quedó abierto de
-- un día concreto.
--
-- El problema es que la tablet manda y sincroniza en un solo sentido: si
-- después de cerrar desde el panel el celular vuelve a subir uno de esos
-- cobros —porque lo marcó entregado, o porque tiene una versión cacheada
-- de la página—, lo subiría con el cierre vacío y lo reabriría.
--
-- Por eso esta regla: un cobro que ya tiene cierre NO cambia de cierre.
-- Nadie reabre ni renombra; lo primero que lo cerró —la tablet o el
-- panel— es lo que vale. El resto de la fila se sigue actualizando normal.
--
-- Idempotente.
-- =====================================================================

create or replace function public.caja_cierre_fijo()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(old.cierre, '') <> '' then
    new.cierre := old.cierre;
  end if;
  return new;
end;
$$;

drop trigger if exists caja_cierre_fijo_trg on public.caja_pedidos;
create trigger caja_cierre_fijo_trg
  before update on public.caja_pedidos
  for each row execute function public.caja_cierre_fijo();

-- el panel busca los días que quedaron abiertos sin importar la fecha
create index if not exists caja_pedidos_abiertos_idx
  on public.caja_pedidos (creado)
  where cierre = '';
