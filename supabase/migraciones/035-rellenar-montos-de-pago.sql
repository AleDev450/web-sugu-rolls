-- =====================================================================
-- 035 — Que el servidor complete el reparto del cobro
-- =====================================================================
-- Síntoma: el cierre "Kelly1642martes" muestra 17 pedidos en efectivo y 75
-- en Yape, pero ambos con monto S/ 0.00, mientras que "ALEJANDRO MARTES"
-- sale correcto.
--
-- Causa: `monto_yape` y `monto_efectivo` los empezó a mandar la caja a
-- partir de la 031, y esa migración rellenó de una vez las filas que ya
-- existían —las de Alejandro—. Los pedidos de Kelly se subieron DESPUÉS,
-- desde un celular que todavía tenía cargada una versión anterior de la
-- página: al no mandar esas dos columnas, la base les puso su valor por
-- defecto, 0. El método sí llegó bien, y por eso los conteos cuadran y los
-- montos no.
--
-- Aquí se arregla de raíz, no solo el dato de hoy: el reparto pasa a
-- deducirlo el SERVIDOR cuando el cliente no lo manda. Un pago de un solo
-- medio no tiene nada que repartir —o es todo efectivo o es todo Yape—, así
-- que no hay motivo para depender de que la versión del navegador de turno
-- lo calcule. Con esto, un celular con la página cacheada vuelve a subir
-- datos correctos.
--
-- Solo se completa cuando llegan los DOS montos en cero, que es la señal de
-- "no me lo mandaron". Un reparto mitad y mitad de verdad nunca se toca, y
-- tarjeta y canje se fuerzan a cero porque por ahí no entra plata ni al
-- cajón ni al Yape.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. El sello ahora también normaliza el reparto
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

  /*
   * Reparto del cobro. Los dos montos en cero significan que el cliente no
   * los mandó: se deducen del método.
   *
   * Un mixto sin repartir cae en efectivo, que es exactamente lo que hace
   * la caja cuando la casilla de Yape se queda vacía. Da igual que sea
   * raro: lo que no puede pasar es que el pedido cuente como cobrado y no
   * aparezca en ninguna vía, porque entonces el arqueo no cuadraría.
   */
  if new.metodo in ('tarjeta', 'canje') then
    new.monto_yape     := 0;
    new.monto_efectivo := 0;
  elsif new.monto_yape = 0 and new.monto_efectivo = 0 then
    if new.metodo = 'yape' then
      new.monto_yape := new.total;
    else
      new.monto_efectivo := new.total;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Arreglar lo que ya está guardado
-- ---------------------------------------------------------------------

update public.caja_pedidos
set monto_efectivo = total
where metodo in ('efectivo', 'mixto') and monto_yape = 0 and monto_efectivo = 0;

update public.caja_pedidos
set monto_yape = total
where metodo = 'yape' and monto_yape = 0 and monto_efectivo = 0;

-- tarjeta y canje: nunca por el cajón ni por el Yape
update public.caja_pedidos
set monto_yape = 0, monto_efectivo = 0
where metodo in ('tarjeta', 'canje')
  and (monto_yape <> 0 or monto_efectivo <> 0);

-- Comprobación: por cada cierre, la suma de los montos debe coincidir con
-- lo cobrado que no sea canje.
--   select cierre,
--          sum(monto_efectivo) as efectivo,
--          sum(monto_yape)     as yape,
--          sum(total) filter (where metodo = 'canje') as canje,
--          sum(total) filter (where pagado)           as cobrado_con_canje
--   from public.caja_pedidos
--   group by cierre
--   order by cierre;
