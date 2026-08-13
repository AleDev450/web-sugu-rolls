-- =====================================================================
-- 009 — Categorías nuevas de la carta
-- =====================================================================
-- Onigiri, Temaki, Handroll, Burrito Roll, Platos calientes y Salsas extras.
--
-- El `orden` deja los rolls juntos y manda al final lo que acompaña (salsas
-- y bebidas), que es como se lee una carta: primero lo que se elige, después
-- lo que se añade.
--
-- Idempotente: `do update` refresca nombre, descripción y orden si vuelves a
-- ejecutarla, sin duplicar filas ni tocar los productos ya asignados.
-- =====================================================================

insert into public.categories (id, nombre, descripcion, orden) values
  ('makis',           'Makis',           'Nuestros rolls preparados al momento',        1),
  ('burrito-roll',    'Burrito Roll',    'Rolls grandes tipo burrito, para comer solo', 2),
  ('handroll',        'Handroll',        'Conos de alga rellenos, listos para la mano', 3),
  ('temaki',          'Temaki',          'Conos rellenos al estilo tradicional',        4),
  ('onigiri',         'Onigiri',         'Bolas de arroz rellenas',                     5),
  ('bowls',           'Bowls',           'Arroz, proteína y toppings en un tazón',      6),
  ('platos-calientes','Platos calientes','Salteados y frituras recién hechos',          7),
  ('entradas',        'Entradas',        'Para empezar o compartir',                    8),
  ('salsas-extras',   'Salsas y extras', 'Para acompañar y subir de nivel tu pedido',   9),
  ('bebidas',         'Bebidas',         'Refrescos y limonadas de la casa',           10)
on conflict (id) do update
set nombre      = excluded.nombre,
    descripcion = excluded.descripcion,
    orden       = excluded.orden;

-- ---------------------------------------------------------------------
-- Comprobación: el orden en que saldrán los filtros de la carta.
-- ---------------------------------------------------------------------
select orden,
       id,
       nombre,
       (select count(*) from public.products p where p.categoria = c.id) as productos
from public.categories c
where activa
order by orden;
