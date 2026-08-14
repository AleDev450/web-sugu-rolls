# Migraciones

Cada cambio en la base de datos entra aquí como **un archivo numerado**, con
solo lo que hay que ejecutar esa vez.

## Cómo usarlas

1. Abre Supabase → **SQL Editor** → **New query**.
2. Pega el contenido del archivo que falte, de menor a mayor número.
3. **Run**.

Todas son idempotentes: si dudas de si ya la corriste, córrela otra vez. No
duplican columnas ni pierden datos.

## Por qué existen

Los archivos grandes de `/supabase` (`schema.sql`, `contenido.sql`,
`tienda.sql`) son la **foto completa** del esquema: sirven para levantar una
base desde cero y para leer cómo está montado todo. Pero no dicen qué falta
por aplicar en una base que ya existe. Eso es lo que responden estas
migraciones.

Cuando corras una, márcala aquí:

| Archivo | Qué hace | Ejecutada |
|---|---|---|
| `001-sugu-club-cinco-niveles.sql` | Bronce y Plata; los niveles pasan de 4 a 5 | ☐ |
| `002-antitrampas-puntaje.sql` | Techo de puntaje según el tiempo jugado | ☐ |
| `003-legales-editables.sql` | Términos y privacidad editables desde el panel | ☐ |
| `004-usuarios-panel.sql` | Listado paginado de usuarios con su nivel de tarjeta | ☐ |
| `005-ajuste-manual-de-puntos.sql` | Sumar y restar puntos a mano; corrige el cálculo de nivel | ☐ |
| `006-imagenes-de-productos.sql` | Almacén para subir fotos de la carta desde el panel | ☐ |
| `007-presentaciones-de-producto.sql` | Precios por cantidad (por 5, por 10…) editables | ☐ |
| `008-cargar-presentaciones.sql` | Deja todos los productos en 5/15, 10/25 y 20/45 | ☐ |
| `009-categorias-nuevas.sql` | Onigiri, Temaki, Handroll, Burrito Roll, calientes y salsas | ☐ |
| `010-opciones-de-producto.sql` | Productos configurables por grupos de opciones | ☐ |
| `011-opciones-pokebowl.sql` | Carga base, toppings, proteína y salsas en los bowls | ☐ |
| `012-imagenes-de-contenido.sql` | Subir imágenes también en paquetes y secciones | ☐ |
| `013-delivery-y-comprobante.sql` | Costo de delivery por pedido y adjuntar el Yape | ☐ |
| `014-slider-horario-y-categorias.sql` | Slider de portada, horario de tienda y borrar usuarios | ☐ |
| `015-encuadre-del-slider.sql` | Encuadre por dispositivo y velo ajustable en el slider | ☐ |
| `016-margen-del-slider.sql` | Separación ajustable entre el header y el slider | ☐ |
| `017-libro-de-reclamaciones.sql` | Libro de Reclamaciones virtual y política de cookies | ☐ |
| `018-acceso-con-google.sql` | Perfil completo al entrar con Google (nombre y apellido) | ☐ |
