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
